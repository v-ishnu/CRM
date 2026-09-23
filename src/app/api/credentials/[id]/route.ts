import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Credential from '@/models/Credential';
import Task from '@/models/Task';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { AuditService } from '@/services/audit.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    const cred = await Credential.findById(id)
      .populate('clientId', 'name clientCode email')
      .populate('projectId', 'name projectCode')
      .populate('taskId', 'title taskCode');

    if (!cred) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Credential not found' } },
        { status: 404 }
      );
    }

    let serviceName = '';
    let usernameText = '';
    let loginUrlText = '';
    try {
      if (cred.service) serviceName = decrypt(cred.service);
      if (cred.username) usernameText = decrypt(cred.username);
      if (cred.loginUrl) loginUrlText = decrypt(cred.loginUrl);
    } catch (e) {
      // ignore
    }

    return NextResponse.json({
      success: true,
      data: {
        _id: cred._id,
        clientId: cred.clientId,
        projectId: cred.projectId,
        taskId: cred.taskId,
        service: serviceName,
        username: usernameText,
        loginUrl: loginUrlText,
        credentialType: cred.credentialType,
        source: cred.source,
        version: cred.version,
        isRevoked: cred.isRevoked,
        createdAt: cred.createdAt,
        updatedAt: cred.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role');

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const cred = await Credential.findById(id);
    if (!cred) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Credential not found' } },
        { status: 404 }
      );
    }

    const updatedFields: string[] = [];

    if (body.service && body.service.trim() !== '') {
      cred.service = encrypt(body.service.trim(), 'service');
      updatedFields.push('service');
    }

    if (body.username && body.username.trim() !== '') {
      cred.username = encrypt(body.username.trim(), 'username');
      updatedFields.push('username');
    }

    // Changing password: encrypt new value, replace old encrypted block, increment version
    if (body.password && body.password.trim() !== '') {
      cred.password = encrypt(body.password.trim(), 'password');
      cred.version = (cred.version || 1) + 1;
      updatedFields.push('password');
    }

    if (body.loginUrl !== undefined) {
      cred.loginUrl = body.loginUrl ? encrypt(body.loginUrl.trim(), 'loginUrl') : undefined;
      updatedFields.push('loginUrl');
    }

    if (body.additionalInfo !== undefined) {
      cred.additionalInfo = body.additionalInfo ? encrypt(body.additionalInfo.trim(), 'additionalInfo') : undefined;
      updatedFields.push('additionalInfo');
    }

    if (body.credentialType) {
      cred.credentialType = body.credentialType.toUpperCase().trim();
      updatedFields.push('credentialType');
    }

    if (body.isRevoked !== undefined) {
      cred.isRevoked = !!body.isRevoked;
      updatedFields.push('isRevoked');
    }

    await cred.save();

    // Log audit event without secrets
    await AuditService.logAction(actor, 'CREDENTIAL_UPDATED', 'Credential', cred._id, {
      credentialId: cred._id.toString(),
      clientId: cred.clientId.toString(),
      projectId: cred.projectId?.toString() || null,
      updatedFields,
      newVersion: cred.version,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: cred._id,
        version: cred.version,
        updatedFields,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role');

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
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

    // Remove from any task requiredCredentialIds
    await Task.updateMany(
      { requiredCredentialIds: cred._id },
      { $pull: { requiredCredentialIds: cred._id } }
    );

    await Credential.deleteOne({ _id: cred._id });

    // Audit log (never includes secrets)
    await AuditService.logAction(actor, 'CREDENTIAL_DELETED', 'Credential', cred._id, {
      credentialId: cred._id.toString(),
      clientId: cred.clientId.toString(),
      projectId: cred.projectId?.toString() || null,
      credentialType: cred.credentialType,
      source: cred.source,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Credential deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
