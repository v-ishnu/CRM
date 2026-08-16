import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db/connect';
import DataRequest from '@/models/DataRequest';
import Credential from '@/models/Credential';
import User from '@/models/User';
import { decrypt } from '@/lib/security/encryption';
import { AuditService } from '@/services/audit.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userRole = req.headers.get('x-user-role');
  const userEmail = req.headers.get('x-user-email');

  if (userRole !== 'ADMIN' || !userEmail) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;
    const { password } = await req.json().catch(() => ({}));

    if (!password) {
      return NextResponse.json(
        { success: false, error: { code: 'PASSWORD_REQUIRED', message: 'Password confirmation is required' } },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: userEmail });
    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'User not found or unauthenticated' } },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: 'Incorrect admin password confirmation' } },
        { status: 401 }
      );
    }

    const request = await DataRequest.findById(id);
    if (!request) {
      return NextResponse.json(
        { success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found' } },
        { status: 404 }
      );
    }

    const cred = await Credential.findOne({ requestId: id });
    if (!cred) {
      return NextResponse.json(
        { success: false, error: { code: 'CREDENTIAL_NOT_FOUND', message: 'Encrypted credentials not found' } },
        { status: 404 }
      );
    }

    const decrypted = {
      service: decrypt(cred.service),
      username: decrypt(cred.username),
      password: decrypt(cred.password),
      loginUrl: cred.loginUrl && cred.loginUrl.ciphertext ? decrypt(cred.loginUrl) : '',
      additionalInfo: cred.additionalInfo && cred.additionalInfo.ciphertext ? decrypt(cred.additionalInfo) : '',
    };

    // Log the decryption action
    await AuditService.logAction(
      userEmail,
      'CREDENTIAL_VIEWED',
      'Credential',
      cred._id.toString(),
      {
        requestId: request.requestId,
        clientId: request.clientId.toString(),
        title: request.title,
      }
    );

    return NextResponse.json({ success: true, data: decrypted });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
