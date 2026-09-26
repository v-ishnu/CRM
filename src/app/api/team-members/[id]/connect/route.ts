import { NextRequest, NextResponse } from 'next/server';
import { TeamMemberService } from '@/services/team-member.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const role = req.headers.get('x-user-role');

  if (role && role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required to generate connection link' } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const result = await TeamMemberService.generateTelegramConnectionToken(id, actor);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const isNotFound = error.message?.includes('not found');
    return NextResponse.json(
      { success: false, error: { code: isNotFound ? 'NOT_FOUND' : 'TOKEN_GENERATION_FAILED', message: error.message } },
      { status: isNotFound ? 404 : 400 }
    );
  }
}

