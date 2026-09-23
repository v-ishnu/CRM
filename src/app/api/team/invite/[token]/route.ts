import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/services/invitation.service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invitation = await InvitationService.verifyInvitationToken(token);

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_INVITATION', message: error.message || 'Invalid or expired invitation' },
      },
      { status: 400 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_FAILED', message: 'Full name is required' } },
        { status: 400 }
      );
    }
    if (!body.email || !body.email.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_FAILED', message: 'Email address is required' } },
        { status: 400 }
      );
    }

    const { teamMember } = await InvitationService.onboardTeamMember(token, {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.trim(),
      bankDetails: body.bankDetails,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: teamMember._id,
        name: teamMember.name,
        email: teamMember.email,
        role: teamMember.role,
        status: teamMember.status,
      },
      message: 'Welcome to the team! Your profile has been created successfully.',
    });
  } catch (error: any) {
    console.error('Team member onboarding error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ONBOARDING_FAILED', message: error.message || 'Onboarding failed' },
      },
      { status: 400 }
    );
  }
}
