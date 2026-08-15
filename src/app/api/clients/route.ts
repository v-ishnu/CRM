import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbConnect } from '@/lib/db/connect';
import fs from 'fs';
import path from 'path';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import { ClientService } from '@/services/client.service';
import { ProjectService } from '@/services/project.service';
import { PaymentService } from '@/services/payment.service';
import { InvoiceService } from '@/services/invoice.service';
import { NotificationService } from '@/services/notification.service';

const getClientsSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
});

// Code generator helpers
async function generateNextClientCode(): Promise<string> {
  const lastClient = await Client.findOne().sort({ clientCode: -1 });
  let nextSeq = 1;
  if (lastClient) {
    const lastCode = lastClient.clientCode;
    const lastSeq = parseInt(lastCode.replace('CL-', ''), 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }
  return `CL-${String(nextSeq).padStart(4, '0')}`;
}

async function generateNextProjectCode(): Promise<string> {
  const lastProject = await Project.findOne().sort({ projectCode: -1 });
  let nextSeq = 1;
  if (lastProject) {
    const lastCode = lastProject.projectCode;
    const lastSeq = parseInt(lastCode.replace('PR-', ''), 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }
  return `PR-${String(nextSeq).padStart(4, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = getClientsSchema.parse({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const result = await ClientService.queryClients(params);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-email') || 'admin';
  let createdClient: any = null;
  let createdProject: any = null;
  let createdInvoice: any = null;
  let createdPayment: any = null;

  try {
    await dbConnect();
    const body = await req.json();

    // 1. Create client
    const clientCode = await generateNextClientCode();
    const clientData = {
      clientCode,
      name: body.clientName || body.name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      address: body.address,
      city: body.city,
      state: body.state,
      country: body.country,
      onboardingDate: body.onboardingDate ? new Date(body.onboardingDate) : new Date(),
      status: body.clientStatus || 'ACTIVE',
      notes: body.clientNotes || body.notes,
    };

    createdClient = await ClientService.createClient(clientData, actor);

    // 2. Create project
    const projectCode = await generateNextProjectCode();
    const projectData = {
      projectCode,
      clientId: createdClient._id,
      name: body.projectName,
      description: body.projectDescription,
      serviceType: body.serviceType || 'WEBSITE',
      totalAmount: Number(body.totalAmount),
      currency: body.currency || 'INR',
      status: 'IN_PROGRESS' as const,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      expectedCompletionDate: body.expectedCompletionDate ? new Date(body.expectedCompletionDate) : undefined,
    };

    createdProject = await ProjectService.createProject(projectData, actor);

    // 3. Create Invoice
    const invoiceItem = {
      description: `${createdProject.name} - ${createdProject.serviceType} Development`,
      quantity: 1,
      unitPrice: createdProject.totalAmount,
    };

    createdInvoice = await InvoiceService.createInvoice(
      {
        clientId: createdClient._id.toString(),
        projectId: createdProject._id.toString(),
        items: [invoiceItem],
        dueDate: projectData.expectedCompletionDate,
        notes: 'Initial project setup invoice',
      },
      actor
    );

    // 4. Optionally record payment
    const paymentAmount = Number(body.paymentAmount);
    if (paymentAmount > 0) {
      createdPayment = await PaymentService.recordPayment(
        {
          clientId: createdClient._id,
          projectId: createdProject._id,
          invoiceId: createdInvoice._id,
          amount: paymentAmount,
          paymentMethod: body.paymentMethod || 'BANK_TRANSFER',
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          transactionReference: body.transactionReference,
          notes: 'Advance project payment',
        },
        actor
      );
    }

    // 5. Send Onboarding / Payment telegram update
    let telegramDispatched = false;
    let telegramError = '';
    
    try {
      const notification = await NotificationService.sendOnboardingNotification(
        createdClient._id.toString(),
        createdProject._id.toString(),
        createdPayment?._id?.toString(),
        createdInvoice._id.toString()
      );
      telegramDispatched = notification.status === 'SENT';
      if (notification.error) {
        telegramError = notification.error;
      }
    } catch (telegramErr: any) {
      console.error('Failed to send Telegram notification:', telegramErr);
      telegramError = telegramErr.message || 'Telegram Bot connection error';
    }

    return NextResponse.json({
      success: true,
      data: {
        client: createdClient,
        project: createdProject,
        invoice: createdInvoice,
        payment: createdPayment,
        telegramDispatched,
        telegramError,
      },
    });
  } catch (error: any) {
    console.error('Onboarding Transaction Failure:', error);
    
    // Clean up created resources in reverse order to ensure atomicity
    try {
      if (createdPayment) {
        await Payment.deleteOne({ _id: createdPayment._id });
      }
      if (createdInvoice) {
        await Invoice.deleteOne({ _id: createdInvoice._id });
        const pdfFullPath = path.join(process.cwd(), 'public', 'invoices', `${createdInvoice.invoiceNumber}.pdf`);
        if (fs.existsSync(pdfFullPath)) {
          fs.unlinkSync(pdfFullPath);
        }
      }
      if (createdProject) {
        await Project.deleteOne({ _id: createdProject._id });
      }
      if (createdClient) {
        await Client.deleteOne({ _id: createdClient._id });
      }
    } catch (cleanupError) {
      console.error('Failed to run onboarding cleanup:', cleanupError);
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ONBOARDING_FAILED',
          message: error.message || 'Onboarding client failed',
        },
      },
      { status: 500 }
    );
  }
}
