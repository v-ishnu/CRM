import { NextRequest, NextResponse } from 'next/server';
import { MessageTemplateService } from '@/services/message-template.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, customBody, customSubject, variables } = body;

    if (!key) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Template key is required' } },
        { status: 400 }
      );
    }

    const preview = await MessageTemplateService.previewTemplate(
      key,
      customBody,
      customSubject,
      variables || {}
    );

    return NextResponse.json({ success: true, data: preview });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'PREVIEW_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
