import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/services/invitation.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actorEmail = req.headers.get('x-user-email') || 'admin';
  const actorRole = req.headers.get('x-user-role');

  if (actorRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const invitation = await InvitationService.revokeInvitation(id, actorEmail);

    return NextResponse.json({
      success: true,
      data: invitation,
      message: 'Invitation revoked successfully',
    });
  } catch (error: any) {
    console.error('Revoke invitation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'REVOKE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
