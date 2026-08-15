import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import { AuditService } from '@/services/audit.service';
import { InvoiceService } from '@/services/invoice.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    const invoice = await Invoice.findById(id)
      .populate('clientId', 'name clientCode email phone company address city country')
      .populate('projectId', 'name projectCode serviceType totalAmount');

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' } },
        { status: 404 }
      );
    }

    const userRole = req.headers.get('x-user-role');
    const userEmail = req.headers.get('x-user-email');
    const client = invoice.clientId as any;

    if (userRole === 'CLIENT' && client && client.email !== userEmail) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Retrieve completed payments for this invoice
    const payments = await Payment.find({ invoiceId: id, status: 'COMPLETED' });
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        invoice,
        totalPaid,
        balanceDue: Math.max(0, invoice.total - totalPaid),
        payments,
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

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' } },
        { status: 404 }
      );
    }

    const oldStatus = invoice.status;

    // Allowed updates
    if (body.status !== undefined) {
      invoice.status = body.status;
    }
    if (body.notes !== undefined) {
      invoice.notes = body.notes;
    }

    const updatedInvoice = await invoice.save();

    // Regenerate PDF to ensure status reflects updated fields
    await InvoiceService.generatePDF(id);

    await AuditService.logAction(actor, 'INVOICE_SENT', 'Invoice', id, {
      oldStatus,
      newStatus: updatedInvoice.status,
    });

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
    });
  } catch (error: any) {
    console.error('Invoice update API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
