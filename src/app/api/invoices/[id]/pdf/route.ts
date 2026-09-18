import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Invoice from '@/models/Invoice';
import { InvoiceService } from '@/services/invoice.service';
import { StorageService } from '@/services/storage.service';

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

    let fileBuffer: Buffer | null = null;
    if (invoice.pdfStoragePath) {
      try {
        fileBuffer = await StorageService.getInvoicePDF(invoice.pdfStoragePath);
      } catch (storageErr) {
        console.warn('PDF not found at recorded path, regenerating on-demand:', storageErr);
      }
    }

    // Regenerate on-demand if missing in storage metadata or fileBuffer couldn't be loaded
    if (!fileBuffer) {
      const generatedInvoice = await InvoiceService.generatePDF(id);
      invoice.pdfStoragePath = generatedInvoice.pdfStoragePath;
      fileBuffer = await StorageService.getInvoicePDF(invoice.pdfStoragePath!);
    }

    return new Response(new Uint8Array(fileBuffer), {
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
