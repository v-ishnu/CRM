import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import {
  InquiryService,
  MAX_INQUIRY_ATTACHMENT_SIZE_BYTES,
  MAX_INQUIRY_ATTACHMENT_SIZE_MB,
} from '@/services/inquiry.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    await dbConnect();
    const { id } = await params;

    const contentType = req.headers.get('content-type') || '';
    let message = '';
    let adminName = 'Admin';
    let attachment:
      | { buffer: Buffer; fileName: string; mimeType: string; size: number }
      | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      message = (formData.get('message') as string) || '';
      adminName = (formData.get('adminName') as string) || 'Admin';

      const file = formData.get('file') as File | null;
      if (file && typeof file === 'object' && file.size > 0) {
        if (file.size > MAX_INQUIRY_ATTACHMENT_SIZE_BYTES) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'FILE_TOO_LARGE',
                message: `File is too large. Maximum allowed size is ${MAX_INQUIRY_ATTACHMENT_SIZE_MB} MB.`,
              },
            },
            { status: 400 }
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        attachment = {
          buffer: Buffer.from(arrayBuffer),
          fileName: file.name || 'attachment',
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        };
      }
    } else {
      const body = await req.json();
      message = body.message || '';
      adminName = body.adminName || 'Admin';
    }

    if (!message.trim() && !attachment) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please provide a message text or attach a file.',
          },
        },
        { status: 400 }
      );
    }

    const updatedInquiry = await InquiryService.sendAdminReply(
      id,
      actor,
      adminName,
      message,
      attachment
    );

    return NextResponse.json({ success: true, data: updatedInquiry });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
