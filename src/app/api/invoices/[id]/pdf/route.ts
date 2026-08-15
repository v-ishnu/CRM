import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Invoice from '@/models/Invoice';
import { InvoiceService } from '@/services/invoice.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    const invoice = await Invoice.findById(id).populate('clientId', 'email');
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

    const pdfFullPath = path.join(process.cwd(), 'public', 'invoices', `${invoice.invoiceNumber}.pdf`);

    // Regenerate on-demand if missing
    if (!fs.existsSync(pdfFullPath)) {
      await InvoiceService.generatePDF(id);
    }

    if (!fs.existsSync(pdfFullPath)) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Invoice PDF file could not be generated' } },
        { status: 500 }
      );
    }

    const fileBuffer = fs.readFileSync(pdfFullPath);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Invoice PDF serving error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
