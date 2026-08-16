import { NextRequest, NextResponse } from 'next/server';
import { TeamPaymentService } from '@/services/team-payment.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const summary = await TeamPaymentService.getProjectTeamPaymentSummary(id);
    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
