import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { ProjectService } from '@/services/project.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const projects = await ProjectService.queryProjects({ clientId, status, search });
    return NextResponse.json({ success: true, data: projects });
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

    const project = await ProjectService.createProject(body, actor);

    // Create Invoice if totalAmount > 0 and not explicitly disabled
    let invoice = null;
    if (body.createInvoice !== false && project.totalAmount > 0) {
      try {
        const { InvoiceService } = await import('@/services/invoice.service');
        const invoiceItem = {
          description: `${project.name} - ${project.serviceType} Development`,
          quantity: 1,
          unitPrice: project.totalAmount,
        };

        invoice = await InvoiceService.createInvoice(
          {
            clientId: project.clientId.toString(),
            projectId: project._id.toString(),
            items: [invoiceItem],
            dueDate: project.expectedCompletionDate,
            notes: 'Project setup invoice',
          },
          actor
        );
      } catch (invErr) {
        console.error('Failed to auto-create invoice for new project:', invErr);
      }
    }

    return NextResponse.json({ success: true, data: { project, invoice } });
  } catch (error: any) {
    console.error('Project creation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROJECT_CREATION_FAILED',
          message: error.message || 'Could not create project',
        },
      },
      { status: 500 }
    );
  }
}
