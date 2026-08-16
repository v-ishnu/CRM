import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbConnect } from '@/lib/db/connect';
import Inquiry from '@/models/Inquiry';

const querySchema = z.object({
  status: z.string().optional(),
  conversationMode: z.string().optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.parse({
      status: searchParams.get('status') || undefined,
      conversationMode: searchParams.get('conversationMode') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const page = Math.max(1, parsed.page || 1);
    const limit = Math.max(1, Math.min(100, parsed.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (parsed.status && parsed.status !== 'ALL') {
      filter.status = parsed.status;
    }
    if (parsed.conversationMode && parsed.conversationMode !== 'ALL') {
      filter.conversationMode = parsed.conversationMode;
    }
    if (parsed.search) {
      const q = parsed.search.trim();
      filter.$or = [
        { inquiryNumber: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { telegramUsername: { $regex: q, $options: 'i' } },
        { telegramUserId: { $regex: q, $options: 'i' } },
        { service: { $regex: q, $options: 'i' } },
        { message: { $regex: q, $options: 'i' } },
      ];
    }

    const [inquiries, total] = await Promise.all([
      Inquiry.find(filter)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Inquiry.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: inquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
