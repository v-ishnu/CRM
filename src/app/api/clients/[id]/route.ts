import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import AuditLog from '@/models/AuditLog';
import Notification from '@/models/Notification';
import { AuditService } from '@/services/audit.service';
import { PaymentService } from '@/services/payment.service';
import { StorageService } from '@/services/storage.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    const client = await Client.findById(id);
    if (!client) {
      return NextResponse.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      );
    }

    const userRole = req.headers.get('x-user-role');
    const userEmail = req.headers.get('x-user-email');

    if (userRole === 'CLIENT' && client.email !== userEmail) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Projects
    const projects = await Project.find({ clientId: id });
    
    // Invoices
    const invoices = await Invoice.find({ clientId: id }).sort({ createdAt: -1 });

    // Payments
    const payments = await Payment.find({ clientId: id }).sort({ paymentDate: -1 });

    // Financial calculations
    let totalProjectValue = 0;
    let totalPaid = 0;
    
    for (const p of projects) {
      const balances = await PaymentService.calculateProjectBalances(p._id.toString());
      totalProjectValue += balances.totalAmount;
      totalPaid += balances.paidAmount;
    }

    const outstanding = Math.max(0, totalProjectValue - totalPaid);

    // Audit logs
    const auditLogs = await AuditLog.find({
      $or: [
        { entityId: id },
        { 'metadata.clientId': id },
        { 'metadata.projectId': { $in: projects.map((p) => p._id) } },
      ],
    }).sort({ timestamp: -1 });

    return NextResponse.json({
      success: true,
      data: {
        client,
        projects,
        invoices,
        payments,
        auditLogs,
        financials: {
          totalProjectValue,
          totalPaid,
          outstanding,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role');

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const client = await Client.findById(id);
    if (!client) {
      return NextResponse.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      );
    }

    // Prevent modifying clientCode directly if it exists, or validate it
    delete body.clientCode;

    Object.assign(client, body);
    const updatedClient = await client.save();

    await AuditService.logAction(actor, 'CLIENT_UPDATED', 'Client', updatedClient._id, {
      updatedFields: Object.keys(body),
    });

    return NextResponse.json({
      success: true,
      data: updatedClient,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role');

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;

    const client = await Client.findById(id);
    if (!client) {
      return NextResponse.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      );
    }

    // 1. Find all invoices for this client to retrieve their storage paths
    const invoices = await Invoice.find({ clientId: id });

    // 2. Delete Supabase Storage PDFs first to prevent orphaned files
    for (const inv of invoices) {
      if (inv.pdfStoragePath) {
        try {
          await StorageService.deleteInvoicePDF(inv.pdfStoragePath);
        } catch (supabaseError: any) {
          console.error(`Failed to delete Supabase storage PDF for invoice ${inv.invoiceNumber}:`, supabaseError);
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'SUPABASE_CLEANUP_FAILED',
                message: `Failed to clean up invoice PDF ${inv.invoiceNumber} from Supabase Storage: ${supabaseError.message}`,
              },
            },
            { status: 500 }
          );
        }
      }
    }

    // 3. Find related projects, payments, invoices to clear their audit logs specifically
    const projectIds = (await Project.find({ clientId: id })).map(p => p._id);
    const invoiceIds = invoices.map(i => i._id);
    const paymentIds = (await Payment.find({ clientId: id })).map(p => p._id);

    // 4. Delete MongoDB records sequentially
    await Client.deleteOne({ _id: id });
    await Project.deleteMany({ clientId: id });
    await Invoice.deleteMany({ clientId: id });
    await Payment.deleteMany({ clientId: id });
    await Notification.deleteMany({ clientId: id });

    // Delete associated entity audit logs to ensure clean activity records
    await AuditLog.deleteMany({
      $or: [
        { entityType: 'Client', entityId: id },
        { entityType: 'Project', entityId: { $in: projectIds } },
        { entityType: 'Invoice', entityId: { $in: invoiceIds } },
        { entityType: 'Payment', entityId: { $in: paymentIds } }
      ]
    });

    await AuditService.logAction(actor, 'CLIENT_DELETED', 'Client', id, {
      clientCode: client.clientCode,
      name: client.name,
    });

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete Client API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
