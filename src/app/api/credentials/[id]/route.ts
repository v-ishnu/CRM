import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import Credential from '@/models/Credential';
import Project from '@/models/Project';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { AuditService } from '@/services/audit.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid credential ID format' } },
        { status: 400 }
      );
    }

    const cred = await Credential.findById(id)
      .populate('clientId', 'name clientCode email')
      .populate('projectId', 'name projectCode')
      .populate('taskId', 'title taskCode');

    if (!cred || cred.isRevoked) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Credential not found or has been revoked/deleted' } },
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
      // ignore decryption errors for partial display
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
        isRevoked: !!cred.isRevoked,
        deletedAt: cred.deletedAt,
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
  const userRole = req.headers.get('x-user-role') || 'ADMIN';

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid credential ID format' } },
        { status: 400 }
      );
    }

    const body = await req.json();

    const cred = await Credential.findById(id);
    if (!cred || cred.isRevoked) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Credential not found or has been revoked/deleted' } },
        { status: 404 }
      );
    }

    // Server-side Project Isolation Validation (Section 13 & 14)
    if (body.projectId) {
      if (!mongoose.Types.ObjectId.isValid(body.projectId)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROJECT_ID', message: 'Invalid project ID format' } },
          { status: 400 }
        );
      }
      if (cred.projectId && cred.projectId.toString() !== body.projectId.toString()) {
        await AuditService.logAction(actor, 'CREDENTIAL_ACCESS_DENIED', 'Credential', cred._id, {
          reason: 'CROSS_PROJECT_CREDENTIAL_EDIT_ATTEMPT',
          credProjectId: cred.projectId.toString(),
          attemptedProjectId: body.projectId.toString(),
          timestamp: new Date(),
        });
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Credential belongs to another project' } },
          { status: 403 }
        );
      }
    }

    if (cred.projectId) {
      const project = await Project.findById(cred.projectId);
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Associated project not found' } },
          { status: 404 }
        );
      }
    }

    const updatedFields: string[] = [];

    // Partial updates: only update fields explicitly provided with non-empty values
    if (body.service && typeof body.service === 'string' && body.service.trim() !== '') {
      cred.service = encrypt(body.service.trim(), 'service');
      updatedFields.push('service');
    }

    if (body.username && typeof body.username === 'string' && body.username.trim() !== '') {
      cred.username = encrypt(body.username.trim(), 'username');
      updatedFields.push('username');
    }

    // Changing password: only if new non-empty password provided
    if (body.password && typeof body.password === 'string' && body.password.trim() !== '') {
      cred.password = encrypt(body.password.trim(), 'password');
      cred.version = (cred.version || 1) + 1;
      updatedFields.push('password');
    }

    if (body.loginUrl !== undefined) {
      const trimmedUrl = typeof body.loginUrl === 'string' ? body.loginUrl.trim() : '';
      cred.loginUrl = trimmedUrl.length > 0 ? encrypt(trimmedUrl, 'loginUrl') : undefined;
      updatedFields.push('loginUrl');
    }

    if (body.additionalInfo !== undefined) {
      const trimmedInfo = typeof body.additionalInfo === 'string' ? body.additionalInfo.trim() : '';
      cred.additionalInfo = trimmedInfo.length > 0 ? encrypt(trimmedInfo, 'additionalInfo') : undefined;
      updatedFields.push('additionalInfo');
    }

    if (body.credentialType && typeof body.credentialType === 'string' && body.credentialType.trim() !== '') {
      cred.credentialType = body.credentialType.toUpperCase().trim();
      updatedFields.push('credentialType');
    }

    if (body.taskId !== undefined) {
      if (body.taskId && mongoose.Types.ObjectId.isValid(body.taskId)) {
        cred.taskId = new mongoose.Types.ObjectId(body.taskId);
      } else {
        cred.taskId = undefined;
      }
      updatedFields.push('taskId');
    }

    if (body.isRevoked !== undefined) {
      cred.isRevoked = Boolean(body.isRevoked);
      updatedFields.push('isRevoked');
    }

    await cred.save();

    // Invalidate Redis cache if present
    try {
      const { CacheService } = await import('@/services/cache.service');
      await CacheService.del(`cred:${cred._id}`);
      if (cred.projectId) {
        await CacheService.del(`proj_creds:${cred.projectId}`);
      }
    } catch {
      // Ignore cache errors
    }

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

export const PATCH = PUT;

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const queryProjectId = searchParams.get('projectId');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid credential ID format' } },
        { status: 400 }
      );
    }

    const cred = await Credential.findById(id);
    if (!cred) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Credential not found' } },
        { status: 404 }
      );
    }

    if (cred.isRevoked && cred.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_DELETED', message: 'Credential has already been deleted' } },
        { status: 400 }
      );
    }

    // Server-side Project Isolation Validation (Section 13 & 14)
    if (queryProjectId) {
      if (!mongoose.Types.ObjectId.isValid(queryProjectId)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROJECT_ID', message: 'Invalid project ID format' } },
          { status: 400 }
        );
      }
      if (cred.projectId && cred.projectId.toString() !== queryProjectId) {
        await AuditService.logAction(actor, 'CREDENTIAL_ACCESS_DENIED', 'Credential', cred._id, {
          reason: 'CROSS_PROJECT_CREDENTIAL_DELETE_ATTEMPT',
          credProjectId: cred.projectId.toString(),
          attemptedProjectId: queryProjectId,
          timestamp: new Date(),
        });
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Credential belongs to another project' } },
          { status: 403 }
        );
      }
    }

    if (cred.projectId) {
      const project = await Project.findById(cred.projectId);
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Associated project not found' } },
          { status: 404 }
        );
      }
    }

    // Soft delete / deactivation: preserve document for historical integrity & audit trails
    cred.isRevoked = true;
    cred.deletedAt = new Date();
    cred.deletedBy = actor;
    await cred.save();

    // Invalidate Redis cache if present
    try {
      const { CacheService } = await import('@/services/cache.service');
      await CacheService.del(`cred:${cred._id}`);
      if (cred.projectId) {
        await CacheService.del(`proj_creds:${cred.projectId}`);
      }
    } catch {
      // Ignore cache errors
    }

    // Audit log (never includes secrets)
    await AuditService.logAction(actor, 'CREDENTIAL_DELETED', 'Credential', cred._id, {
      credentialId: cred._id.toString(),
      clientId: cred.clientId.toString(),
      projectId: cred.projectId?.toString() || null,
      credentialType: cred.credentialType,
      source: cred.source,
      mode: 'SOFT_DELETE_DEACTIVATE',
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Credential deleted successfully',
      data: {
        _id: cred._id,
        isRevoked: true,
        deletedAt: cred.deletedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
