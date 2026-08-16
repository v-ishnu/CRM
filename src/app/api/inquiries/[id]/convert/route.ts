import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbConnect } from '@/lib/db/connect';
import { InquiryService } from '@/services/inquiry.service';

const convertSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
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
    const parsed = convertSchema.parse(body);

    const result = await InquiryService.convertToClient(id, actor, parsed);

    return NextResponse.json({
      success: true,
      data: {
        inquiry: result.inquiry,
        client: result.client,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
