import { NextRequest, NextResponse } from 'next/server';
import { CredentialSharingService } from '@/services/credential-sharing.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  try {
    const { id } = await params;
    const result = await CredentialSharingService.revokeTaskCredentialAccess(id, actor);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Task credential revocation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'TASK_CREDENTIAL_REVOKE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
