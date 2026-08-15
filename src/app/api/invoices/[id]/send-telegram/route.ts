import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Invoice from '@/models/Invoice';
import Client from '@/models/Client';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { InvoiceService } from '@/services/invoice.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' } },
        { status: 404 }
      );
    }

    const client = await Client.findById(invoice.clientId);
    if (!client) {
      return NextResponse.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      );
    }

    if (!client.telegramConnected || !client.telegramChatId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TELEGRAM_NOT_CONNECTED',
            message: 'Client does not have a linked Telegram account. Connect Telegram first.',
          },
        },
        { status: 400 }
      );
    }

    // Regenerate PDF if missing before dispatch
    if (!invoice.pdfPath) {
      invoice.pdfPath = `/invoices/${invoice.invoiceNumber}.pdf`;
      await invoice.save();
    }
    await InvoiceService.generatePDF(id);

    // Send PDF document
    const filename = `${invoice.invoiceNumber}.pdf`;
    const caption = `📄 <b>Invoice ${invoice.invoiceNumber}</b>\n` +
      `Amount: ${invoice.currency} ${invoice.total.toLocaleString('en-IN')}\n` +
      `Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Upon Receipt'}\n` +
      `Status: <b>${invoice.status}</b>`;

    const sent = await TelegramService.sendDocument(
      client.telegramChatId,
      invoice.pdfPath,
      filename,
      caption
    );

    if (!sent) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TELEGRAM_SEND_FAILED',
            message: 'Telegram API failed to deliver the PDF document.',
          },
        },
        { status: 502 }
      );
    }

    // Update status
    invoice.telegramSent = true;
    if (invoice.status === 'DRAFT') {
      invoice.status = 'ISSUED';
    }
    await invoice.save();

    await AuditService.logAction(actor, 'INVOICE_SENT', 'Invoice', id, {
      channel: 'TELEGRAM',
      invoiceNumber: invoice.invoiceNumber,
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice PDF sent successfully via Telegram.',
    });
  } catch (error: any) {
    console.error('Invoice Telegram send error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
