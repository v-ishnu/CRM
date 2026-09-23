import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Agreement from '@/models/Agreement';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    const agreement = await Agreement.findById(id)
      .populate('projectId', 'name projectCode serviceType totalAmount currency status')
      .populate('clientId', 'name clientCode email company telegramConnected telegramUsername');

    if (!agreement) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Agreement not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: agreement,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
