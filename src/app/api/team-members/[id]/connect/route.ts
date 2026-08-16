import { NextRequest, NextResponse } from 'next/server';
import { TeamMemberService } from '@/services/team-member.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    const { id } = await params;
    const result = await TeamMemberService.generateTelegramConnectionToken(id, actor);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'TOKEN_GENERATION_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
