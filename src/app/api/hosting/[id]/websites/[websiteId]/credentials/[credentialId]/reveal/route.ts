import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { HostingService } from '@/services/hosting.service';
import Credential from '@/models/Credential';
import { decrypt } from '@/lib/security/encryption';
import { AuditService } from '@/services/audit.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; websiteId: string; credentialId: string }> }
) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role') || 'ADMIN';

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required to reveal secrets' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id, websiteId, credentialId } = await params;

    const cred = await Credential.findById(credentialId);
    if (
      !cred ||
      cred.isRevoked ||
      (cred.hostingId && cred.hostingId.toString() !== id) ||
      (cred.websiteId && cred.websiteId.toString() !== websiteId)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Credential not found or revoked' } },
        { status: 404 }
      );
    }

    let service = '';
    let username = '';
    let password = '';
    let loginUrl = '';
    let additionalInfo = '';

    try {
      if (cred.service) service = decrypt(cred.service);
      if (cred.username) username = decrypt(cred.username);
      if (cred.password) password = decrypt(cred.password);
      if (cred.loginUrl) loginUrl = decrypt(cred.loginUrl);
      if (cred.additionalInfo) additionalInfo = decrypt(cred.additionalInfo);
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt secrets' } },
        { status: 500 }
      );
    }

    await AuditService.logAction(actor, 'WEBSITE_CREDENTIAL_REVEALED', 'Credential', cred._id, {
      hostingId: id,
      websiteId,
      credentialId,
      actor,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: cred._id,
        service,
        username,
        password,
        loginUrl: loginUrl || undefined,
        additionalInfo: additionalInfo || undefined,
        credentialType: cred.credentialType,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; websiteId: string; credentialId: string }> }
) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role') || 'ADMIN';

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id, websiteId, credentialId } = await params;

    await HostingService.deleteWebsiteCredential(id, websiteId, credentialId, actor);

    return NextResponse.json({
      success: true,
      message: 'Website credential removed successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
