import { NextRequest, NextResponse } from 'next/server';
import { CredentialSharingService } from '@/services/credential-sharing.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const history = await CredentialSharingService.getTaskCredentialAccessHistory(id);
    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
