import { NextRequest, NextResponse } from 'next/server';
import { MessageTemplateService } from '@/services/message-template.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const recipientType = (searchParams.get('recipientType') as any) || undefined;
    const channel = (searchParams.get('channel') as any) || undefined;
    const search = searchParams.get('search') || undefined;

    const templates = await MessageTemplateService.getTemplates({
      recipientType,
      channel,
      search,
    });

    return NextResponse.json({ success: true, data: templates });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'TEMPLATES_FETCH_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  try {
    const count = await MessageTemplateService.seedDefaultTemplates(actor);
    return NextResponse.json({ success: true, data: { seededCount: count } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'TEMPLATES_SEED_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
