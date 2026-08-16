import { NextRequest, NextResponse } from 'next/server';
import { CredentialSharingService } from '@/services/credential-sharing.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  try {
    const { id } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is allowed
    }
    const { oneTime, notes } = body as any;

    const result = await CredentialSharingService.shareTaskCredentials(id, actor, {
      oneTime: oneTime !== undefined ? oneTime : true,
      notes,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Task credential share error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'TASK_CREDENTIAL_SHARE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
