import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import AuditLog from '@/models/AuditLog';
import { AuditService } from '@/services/audit.service';
import { PaymentService } from '@/services/payment.service';

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
