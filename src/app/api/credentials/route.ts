import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import Credential from '@/models/Credential';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Task from '@/models/Task';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { AuditService } from '@/services/audit.service';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const projectId = searchParams.get('projectId');
    const taskId = searchParams.get('taskId');

    const query: Record<string, any> = { isRevoked: { $ne: true } };
    if (clientId) query.clientId = clientId;
    if (projectId) query.projectId = projectId;
    if (taskId) query.taskId = taskId;

    const credentials = await Credential.find(query)
      .populate('clientId', 'name clientCode')
      .populate('projectId', 'name projectCode')
      .populate('taskId', 'title taskCode')
      .sort({ createdAt: -1 })
      .lean();

    // Map to safe masked items (NEVER return password in list)
    const safeList = credentials.map((c: any) => {
      let serviceName = 'Credential';
      let usernameText = '';
      let loginUrlText = '';

      try {
        if (c.service) serviceName = decrypt(c.service);
      } catch {
        serviceName = 'Encrypted Service';
      }

      try {
        if (c.username) usernameText = decrypt(c.username);
      } catch {
        usernameText = '***';
      }

      try {
        if (c.loginUrl) loginUrlText = decrypt(c.loginUrl);
      } catch {
        loginUrlText = '';
      }

      return {
        _id: c._id,
        clientId: c.clientId,
        projectId: c.projectId,
        taskId: c.taskId,
        service: serviceName,
        username: usernameText,
        loginUrl: loginUrlText,
        credentialType: c.credentialType || 'CUSTOM',
        source: c.source || 'CLIENT_REQUEST',
        version: c.version || 1,
        isRevoked: !!c.isRevoked,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    return NextResponse.json({ success: true, data: safeList });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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
    const body = await req.json();
    const {
      clientId,
      projectId,
      taskId,
      credentialType = 'CUSTOM',
      service,
      username,
      password,
      loginUrl,
      additionalInfo,
    } = body;

    // Required fields check
    if (!clientId || !service || !username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'clientId, service, username, and password are required' },
        },
        { status: 400 }
      );
    }

    // Ownership check: Client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return NextResponse.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      );
    }

    // Ownership check: Project belongs to client
    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } },
          { status: 404 }
        );
      }
      if (project.clientId.toString() !== clientId.toString()) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'OWNERSHIP_MISMATCH', message: 'Project does not belong to specified client' },
          },
          { status: 400 }
        );
      }
    }

    // Ownership check: Task belongs to project and client
    if (taskId) {
      const task = await Task.findById(taskId);
      if (!task) {
        return NextResponse.json(
          { success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task not found' } },
          { status: 404 }
        );
      }
      if (task.clientId.toString() !== clientId.toString()) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'OWNERSHIP_MISMATCH', message: 'Task does not belong to specified client' },
          },
          { status: 400 }
        );
      }
      if (projectId && task.projectId.toString() !== projectId.toString()) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'OWNERSHIP_MISMATCH', message: 'Task does not belong to specified project' },
          },
          { status: 400 }
        );
      }
    }

    // Encrypt sensitive fields with AES-256-GCM
    const serviceEnc = encrypt(service.trim(), 'service');
    const usernameEnc = encrypt(username.trim(), 'username');
    const passwordEnc = encrypt(password.trim(), 'password');
    const loginUrlEnc = loginUrl ? encrypt(loginUrl.trim(), 'loginUrl') : undefined;
    const additionalInfoEnc = additionalInfo ? encrypt(additionalInfo.trim(), 'additionalInfo') : undefined;

    const credential = await Credential.create({
      clientId: client._id,
      projectId: projectId ? new mongoose.Types.ObjectId(projectId) : undefined,
      taskId: taskId ? new mongoose.Types.ObjectId(taskId) : undefined,
      credentialType: credentialType.toUpperCase().trim(),
      source: 'MANUAL',
      service: serviceEnc,
      username: usernameEnc,
      password: passwordEnc,
      loginUrl: loginUrlEnc,
      additionalInfo: additionalInfoEnc,
      version: 1,
    });

    // If task specified, automatically link to task's requiredCredentialIds
    if (taskId) {
      await Task.findByIdAndUpdate(taskId, {
        $addToSet: { requiredCredentialIds: credential._id },
      });
    }

    // Audit log (never includes plaintext password or secrets!)
    await AuditService.logAction(actor, 'CREDENTIAL_CREATED', 'Credential', credential._id, {
      credentialId: credential._id.toString(),
      clientId: client._id.toString(),
      projectId: projectId || null,
      taskId: taskId || null,
      createdBy: actor,
      actorType: 'ADMIN',
      credentialType: credential.credentialType,
      source: 'MANUAL',
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: credential._id,
        clientId: credential.clientId,
        projectId: credential.projectId,
        taskId: credential.taskId,
        service: service.trim(),
        username: username.trim(),
        loginUrl: loginUrl ? loginUrl.trim() : undefined,
        credentialType: credential.credentialType,
        source: credential.source,
        version: credential.version,
        createdAt: credential.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Failed to create manual credential:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
