import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/services/invitation.service';

export async function GET(req: NextRequest) {
  const actorRole = req.headers.get('x-user-role');
  if (actorRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const invitations = await InvitationService.getInvitations(status ? { status } : {});
    return NextResponse.json({ success: true, data: invitations });
  } catch (error: any) {
    console.error('List invitations error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'LIST_INVITATIONS_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const actorEmail = req.headers.get('x-user-email') || 'admin';
  const actorRole = req.headers.get('x-user-role');

  if (actorRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await InvitationService.createInvitation(body, actorEmail);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Invitation created successfully',
    });
  } catch (error: any) {
    console.error('Create invitation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_INVITATION_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
