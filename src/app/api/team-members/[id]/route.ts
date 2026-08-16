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
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await TeamMemberService.updateTeamMember(id, body, actor);
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
