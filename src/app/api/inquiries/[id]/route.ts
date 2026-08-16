import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbConnect } from '@/lib/db/connect';
import Inquiry from '@/models/Inquiry';
import { InquiryService } from '@/services/inquiry.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const inquiry = await Inquiry.findById(id)
      .populate('convertedToClientId', 'name clientCode email phone company')
      .lean();

    if (!inquiry) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Inquiry not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: inquiry });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

const patchSchema = z.object({
  action: z.enum(['take', 'return_to_bot', 'close']),
  closingNote: z.string().optional(),
  adminId: z.string().optional(),
  adminName: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.parse(body);

    let updatedInquiry;
    if (parsed.action === 'take') {
      updatedInquiry = await InquiryService.takeInquiry(
        id,
        parsed.adminId || 'admin',
        parsed.adminName || 'Admin',
        actor
      );
    } else if (parsed.action === 'return_to_bot') {
      updatedInquiry = await InquiryService.returnToBot(id, actor);
    } else if (parsed.action === 'close') {
      updatedInquiry = await InquiryService.closeInquiry(id, actor, parsed.closingNote);
    }

    return NextResponse.json({ success: true, data: updatedInquiry });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
