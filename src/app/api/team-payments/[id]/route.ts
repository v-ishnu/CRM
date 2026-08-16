import { NextRequest, NextResponse } from 'next/server';
import TeamPayment from '@/models/TeamPayment';
import { TeamPaymentService } from '@/services/team-payment.service';
import { AuditService } from '@/services/audit.service';
import { dbConnect } from '@/lib/db/connect';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const payment = await TeamPayment.findById(id)
      .populate('teamMemberId', 'name email role')
      .populate('projectId', 'name projectCode')
      .populate('taskId', 'title taskCode agreedAmount')
      .lean();

    if (!payment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment record not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await TeamPaymentService.updateTeamPayment(id, body, actor);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  try {
    await dbConnect();
    const { id } = await params;
    const payment = await TeamPayment.findById(id);
    if (!payment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment record not found' } },
        { status: 404 }
      );
    }

    await TeamPayment.findByIdAndDelete(id);

    await AuditService.log({
      actor,
      action: 'TEAM_PAYMENT_CANCELLED',
      entityType: 'TeamPayment',
      entityId: id,
      metadata: {
        paymentNumber: payment.paymentNumber,
        amount: payment.amount,
        teamMemberId: payment.teamMemberId,
        deleted: true,
      },
    });

    return NextResponse.json({ success: true, message: 'Team payment deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
