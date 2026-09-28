import { NextRequest, NextResponse } from 'next/server';
import { TeamMemberService } from '@/services/team-member.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const member = await TeamMemberService.getTeamMemberById(id);
    return NextResponse.json({ success: true, data: member });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: error.message } },
      { status: 404 }
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

    // Explicit allowlist of profile fields only - bankDetails are strictly prohibited here
    const profilePayload: any = {};
    if (body.name !== undefined) profilePayload.name = body.name;
    if (body.email !== undefined) profilePayload.email = body.email;
    if (body.phone !== undefined) profilePayload.phone = body.phone;
    if (body.designation !== undefined) profilePayload.designation = body.designation;
    if (body.role !== undefined) profilePayload.role = body.role;
    if (body.status !== undefined) profilePayload.status = body.status;
    if (body.telegramUserId !== undefined) profilePayload.telegramUserId = body.telegramUserId;
    if (body.telegramUsername !== undefined) profilePayload.telegramUsername = body.telegramUsername;
    if (body.permissions !== undefined) profilePayload.permissions = body.permissions;

    const updated = await TeamMemberService.updateTeamMember(id, profilePayload, actor);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await TeamMemberService.deleteTeamMember(id, actor);
    return NextResponse.json({ success: true, message: 'Team member deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
