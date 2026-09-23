import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Credential from '@/models/Credential';
import { decrypt } from '@/lib/security/encryption';
import { AuditService } from '@/services/audit.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role');

  // STRICT AUTHORIZATION CHECK
  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only authorized administrators may reveal credentials' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;

    const cred = await Credential.findById(id);
    if (!cred) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Credential not found' } },
        { status: 404 }
      );
    }

    // Decrypt fields
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
    } catch (decErr: any) {
      return NextResponse.json(
        { success: false, error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt credential fields' } },
        { status: 500 }
      );
    }

    // Audit secret reveal (NEVER store the secret in audit log!)
    await AuditService.logAction(actor, 'CREDENTIAL_REVEALED', 'Credential', cred._id, {
      credentialId: cred._id.toString(),
      clientId: cred.clientId.toString(),
      projectId: cred.projectId?.toString() || null,
      adminId: actor,
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
        source: cred.source,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
