import { NextRequest, NextResponse } from 'next/server';
import { TeamMemberService } from '@/services/team-member.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = req.headers.get('x-user-role');
  if (role && role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const member = await TeamMemberService.getTeamMemberById(id);
    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team member not found' } },
        { status: 404 }
      );
    }

    if (!member.bankDetails) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Bank details not added',
      });
    }

    return NextResponse.json({
      success: true,
      data: member.bankDetails,
    });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      { success: false, error: { code: 'GET_FAILED', message: error.message } },
      { status }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const role = req.headers.get('x-user-role');
  if (role && role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();

    // Explicit allowlist of bank fields only - profile fields are ignored
    const bankPayload = {
      accountHolderName: body.accountHolderName,
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      upiId: body.upiId,
      clearAccountNumber: body.clearAccountNumber,
      clearIfsc: body.clearIfsc,
      clearUpiId: body.clearUpiId,
      clearAll: body.clearAll,
    };

    const updated = await TeamMemberService.updateBankDetails(id, bankPayload, actor);
    return NextResponse.json({ success: true, data: updated.bankDetails });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BANK_UPDATE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}

export const PUT = PATCH;
