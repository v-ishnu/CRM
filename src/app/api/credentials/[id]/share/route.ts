import { NextRequest, NextResponse } from 'next/server';
import { CredentialSharingService } from '@/services/credential-sharing.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'Admin';
  try {
    const { id } = await params;
    const body = await req.json();
    const { teamMemberId, oneTime, notes } = body;

    if (!teamMemberId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'teamMemberId is required' } },
        { status: 400 }
      );
    }

    const result = await CredentialSharingService.shareCredentialWithTeamMember(
      id,
      teamMemberId,
      actor,
      { oneTime, notes }
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Credential share API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'CREDENTIAL_SHARE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
