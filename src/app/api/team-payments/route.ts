import { NextRequest, NextResponse } from 'next/server';
import { TeamPaymentService } from '@/services/team-payment.service';

export async function GET(req: NextRequest) {
  try {
    const actorRole = req.headers.get('x-user-role') || 'ADMIN';
    const actorTeamMemberId = req.headers.get('x-team-member-id');

    const { searchParams } = new URL(req.url);
    let teamMemberId = searchParams.get('teamMemberId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const taskId = searchParams.get('taskId') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const search = searchParams.get('search') || undefined;

    // IDOR Protection: Non-admin can only view their own payments
    if (actorRole !== 'ADMIN' && actorTeamMemberId) {
      teamMemberId = actorTeamMemberId;
    }

    const result = await TeamPaymentService.getTeamPayments({
      teamMemberId,
      projectId,
      taskId,
      status,
      startDate,
      endDate,
      search,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  const actorRole = req.headers.get('x-user-role') || 'ADMIN';

  if (actorRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required to record payments' } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const payment = await TeamPaymentService.recordTeamPayment(body, actor);
    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error: any) {
    console.error('Record team payment error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'PAYMENT_CREATION_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
