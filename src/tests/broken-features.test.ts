import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import dotenv from 'dotenv';
import { NextRequest } from 'next/server';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { dbConnect } from '@/lib/db/connect';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import { StorageService } from '@/services/storage.service';

import { POST as createClientRoute } from '@/app/api/clients/route';
import { POST as createInvoiceRoute } from '@/app/api/invoices/route';
import { GET as getInvoicePdf } from '@/app/api/invoices/[id]/pdf/route';

describe('Verification of Broken Features: Create Invoice & View/Download PDF', () => {
  let testClientId: string | null = null;
  let testProjectId: string | null = null;
  let testInvoiceId: string | null = null;

  beforeAll(async () => {
    await dbConnect();
    console.log('\n--- Environment Check in Test ---');
    console.log('MONGODB_URI configured:', !!process.env.MONGODB_URI);
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Configured' : 'Missing');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured' : 'Missing');
    console.log('SUPABASE_INVOICE_BUCKET:', process.env.SUPABASE_INVOICE_BUCKET || 'invoices');
    console.log('StorageService.isConfigured():', StorageService.isConfigured());
  });

  afterAll(async () => {
    if (testClientId) {
      await Client.deleteOne({ _id: testClientId });
      await Project.deleteMany({ clientId: testClientId });
      await Invoice.deleteMany({ clientId: testClientId });
      await Payment.deleteMany({ clientId: testClientId });
    }
  });

  it('TEST 1: Client Onboarding with Project and Invoice (POST /api/clients)', async () => {
    const t0 = performance.now();
    const uniqueEmail = `test_client_${Date.now()}@example.com`;
    const payload = {
      clientName: 'Rahul Diagnostics Ltd',
      email: uniqueEmail,
      phone: '+91 98765 43210',
      company: 'Rahul Diagnostics',
      address: 'Plot 44, Infotech Park',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      clientStatus: 'ACTIVE',
      clientNotes: 'Verification test for invoice creation',
      onboardingDate: new Date().toISOString().split('T')[0],

      projectName: 'Full-Stack CRM Portal',
      serviceType: 'WEB_APPLICATION',
      projectDescription: 'Customer relationship management system build',
      totalAmount: '60000',
      currency: 'INR',
      startDate: new Date().toISOString().split('T')[0],
      expectedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],

      paymentAmount: '20000',
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: new Date().toISOString().split('T')[0],
      transactionReference: 'NEFT-DIAG-9988',
    };

    const req = new NextRequest('http://localhost:3000/api/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'admin@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify(payload),
    });

    const res = await createClientRoute(req);
    const status = res.status;
    const body = await res.json();

    console.log('\n[TEST 1] POST /api/clients Response:');
    console.log('HTTP Status:', status);
    console.log('Body:', JSON.stringify(body, null, 2));

    if (status === 200 && body.success) {
      testClientId = body.data.client._id;
      testProjectId = body.data.project?._id;
      testInvoiceId = body.data.invoice?._id;
    }

    expect(status, `POST /api/clients failed with status ${status}: ${body.error?.message}`).toBe(200);
    expect(body.success).toBe(true);
  }, 30000);

  it('TEST 2: Standalone Invoice Creation (POST /api/invoices)', async () => {
    expect(testClientId, 'testClientId must exist from Test 1').toBeDefined();
    expect(testProjectId, 'testProjectId must exist from Test 1').toBeDefined();

    const req = new NextRequest('http://localhost:3000/api/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'ADMIN',
        'x-user-email': 'admin@example.com',
      },
      body: JSON.stringify({
        clientId: testClientId,
        projectId: testProjectId,
        items: [
          {
            description: 'Phase 2 Architecture & Integration',
            quantity: 1,
            unitPrice: 25000,
          },
        ],
        tax: 0,
        discount: 0,
        notes: 'Phase 2 Deliverables',
      }),
    });

    const res = await createInvoiceRoute(req);
    const status = res.status;
    const body = await res.json();

    console.log('\n[TEST 2] POST /api/invoices Response:');
    console.log('HTTP Status:', status);
    console.log('Body:', JSON.stringify(body, null, 2));

    expect(status, `POST /api/invoices failed with status ${status}: ${body.error?.message}`).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(25000);
  }, 30000);

  it('TEST 3: View / Download Invoice PDF (GET /api/invoices/[id]/pdf)', async () => {
    expect(testInvoiceId, 'testInvoiceId must exist').toBeDefined();

    const req = new NextRequest(`http://localhost:3000/api/invoices/${testInvoiceId}/pdf`, {
      method: 'GET',
      headers: {
        'x-user-role': 'ADMIN',
        'x-user-email': 'admin@example.com',
      },
    });

    const res = await getInvoicePdf(req, { params: Promise.resolve({ id: testInvoiceId! }) });
    console.log('\n[TEST 3] GET /api/invoices/[id]/pdf Response:');
    console.log('HTTP Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));

    if (res.status === 200) {
      const buffer = await res.arrayBuffer();
      console.log('PDF Byte Size:', buffer.byteLength);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(buffer.byteLength).toBeGreaterThan(500);
    } else {
      const errJson = await res.json();
      console.error('PDF Fetch Error:', errJson);
      expect(res.status, `PDF endpoint failed with status ${res.status}: ${errJson.error?.message}`).toBe(200);
    }
  }, 30000);

  it('TEST 4: Create Invoice & Download PDF when Supabase is UNCONFIGURED (Local Fallback)', async () => {
    // Force isConfigured to return false to simulate no Supabase credentials
    const isConfiguredSpy = vi.spyOn(StorageService, 'isConfigured').mockReturnValue(false);

    try {
      const req = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
          'x-user-email': 'admin@example.com',
        },
        body: JSON.stringify({
          clientId: testClientId,
          projectId: testProjectId,
          items: [
            {
              description: 'Offline / Local Fallback Test Service',
              quantity: 1,
              unitPrice: 5000,
            },
          ],
          notes: 'Local Storage Fallback Invoice',
        }),
      });

      const res = await createInvoiceRoute(req);
      const status = res.status;
      const body = await res.json();

      console.log('\n[TEST 4] Standalone Invoice (Unconfigured Supabase) Response:');
      console.log('Status:', status);
      expect(status).toBe(200);
      expect(body.success).toBe(true);

      const localInvoiceId = body.data._id;

      // Download the PDF
      const pdfReq = new NextRequest(`http://localhost:3000/api/invoices/${localInvoiceId}/pdf`, {
        method: 'GET',
        headers: {
          'x-user-role': 'ADMIN',
          'x-user-email': 'admin@example.com',
        },
      });

      const pdfRes = await getInvoicePdf(pdfReq, { params: Promise.resolve({ id: localInvoiceId }) });
      console.log('[TEST 4] PDF Download Status:', pdfRes.status);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get('content-type')).toBe('application/pdf');

      const buf = await pdfRes.arrayBuffer();
      expect(buf.byteLength).toBeGreaterThan(500);

      // Clean up local invoice
      await Invoice.deleteOne({ _id: localInvoiceId });
    } finally {
      isConfiguredSpy.mockRestore();
    }
  }, 30000);
});
