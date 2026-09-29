import { NextRequest, NextResponse } from 'next/server';
import { MessageTemplateService } from '@/services/message-template.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await MessageTemplateService.getTemplateById(id);
    return NextResponse.json({ success: true, data: template });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      { success: false, error: { code: 'TEMPLATE_FETCH_FAILED', message: error.message } },
      { status }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await MessageTemplateService.updateTemplate(id, body, actor);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'TEMPLATE_UPDATE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  try {
    const { id } = await params;
    const reset = await MessageTemplateService.resetTemplate(id, actor);
    return NextResponse.json({ success: true, data: reset });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'TEMPLATE_RESET_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
