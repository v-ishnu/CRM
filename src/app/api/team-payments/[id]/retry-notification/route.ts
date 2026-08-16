import { NextRequest, NextResponse } from 'next/server';
import { TeamPaymentService } from '@/services/team-payment.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  try {
    const { id } = await params;
    const success = await TeamPaymentService.retryTeamPaymentNotification(id, actor);
    return NextResponse.json({
      success,
      message: success ? 'Telegram notification sent successfully' : 'Telegram notification retry failed',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'RETRY_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
