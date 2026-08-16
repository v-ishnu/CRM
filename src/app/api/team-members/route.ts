import { NextRequest, NextResponse } from 'next/server';
import { TeamMemberService } from '@/services/team-member.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const data = await TeamMemberService.getTeamMembers({ role, status, search });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    const body = await req.json();
    const member = await TeamMemberService.createTeamMember(body, actor);
    return NextResponse.json({ success: true, data: member }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'TEAM_MEMBER_CREATE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
