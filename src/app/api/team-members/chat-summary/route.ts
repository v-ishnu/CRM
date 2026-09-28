import { NextRequest, NextResponse } from 'next/server';
import { TeamChatService } from '@/services/team-chat.service';

export async function GET(_req: NextRequest) {
  try {
    const summary = await TeamChatService.getTeamChatSummary();
    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SUMMARY_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
