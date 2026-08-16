import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbConnect } from '@/lib/db/connect';
import { InquiryService } from '@/services/inquiry.service';

const messageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  adminName: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const parsed = messageSchema.parse(body);

    const updatedInquiry = await InquiryService.sendAdminReply(
      id,
      actor,
      parsed.adminName || 'Admin',
      parsed.message
    );

    return NextResponse.json({ success: true, data: updatedInquiry });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
