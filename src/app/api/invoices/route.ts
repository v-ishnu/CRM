import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { InvoiceService } from '@/services/invoice.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const invoices = await InvoiceService.queryInvoices({ clientId, projectId, status, search });
    return NextResponse.json({ success: true, data: invoices });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    await dbConnect();
    const body = await req.json();

    const invoice = await InvoiceService.createInvoice(body, actor);
    return NextResponse.json({ success: true, data: invoice });
  } catch (error: any) {
    console.error('Invoice creation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVOICE_CREATION_FAILED',
          message: error.message || 'Could not create invoice',
        },
      },
      { status: 500 }
    );
  }
}
