import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import Task from '@/models/Task';
import Credential from '@/models/Credential';
import TeamMember from '@/models/TeamMember';
import { decrypt } from '@/lib/security/encryption';
import { AuditService } from '@/services/audit.service';
import { TeamMemberService } from '@/services/team-member.service';

/**
 * GET /api/tasks/[id]/credentials/[credentialId]
 * Secure endpoint to view a specific credential associated with a task.
 * Enforces:
 * 1. Actor is Admin or assigned Team Member
 * 2. Task exists and credential access is not revoked
 * 3. Credential is listed in task.requiredCredentialIds
 * 4. Credential belongs strictly to the task's project (Project Isolation)
 * 5. Credential is active (not revoked/deactivated)
 * 6. Team member's current credential type permission is checked AT VIEW TIME
 * 7. Comprehensive audit logging without leaking secrets
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; credentialId: string }> }
) {
  try {
    await dbConnect();
    const { id: taskId, credentialId } = await params;

    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid task or credential ID format' } },
        { status: 400 }
      );
    }

    const actorEmail = req.headers.get('x-user-email') || 'system';
    const actorRole = req.headers.get('x-user-role') || 'ADMIN';
    let actorTeamMemberId = req.headers.get('x-team-member-id');

    // Resolve teamMemberId by email if not provided directly in header
    if (actorRole !== 'ADMIN' && !actorTeamMemberId && actorEmail) {
      const member = await TeamMember.findOne({ email: actorEmail });
      if (member) {
        actorTeamMemberId = member._id.toString();
      }
    }

    // 1. Fetch Task
    const task = await Task.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // 2. Verify task credential access is not revoked
    if (task.credentialAccessRevoked) {
      await AuditService.log({
        actor: actorEmail,
        action: 'CREDENTIAL_ACCESS_DENIED',
        entityType: 'Task',
        entityId: task._id,
        metadata: {
          taskId: task._id,
          credentialId,
          reason: 'Credential access for this task has been revoked',
        },
      });
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_REVOKED', message: 'Credential access for this task has been revoked' } },
        { status: 403 }
      );
    }

    // 3. Verify task references this credential
    const isCredentialLinked = task.requiredCredentialIds && task.requiredCredentialIds.some(
      (cid: any) => cid.toString() === credentialId
    );
    if (!isCredentialLinked) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Credential is not associated with this task' } },
        { status: 404 }
      );
    }

    // 4. Verify Actor Identity & Permissions
    let teamMember = null;
    if (actorRole !== 'ADMIN') {
      const taskAssigneeId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
      if (!actorTeamMemberId || taskAssigneeId !== actorTeamMemberId.toString()) {
        await AuditService.log({
          actor: actorEmail,
          action: 'CREDENTIAL_ACCESS_DENIED',
          entityType: 'Task',
          entityId: task._id,
          metadata: {
            taskId: task._id,
            credentialId,
            teamMemberId: actorTeamMemberId,
            reason: 'Task is not assigned to this user',
          },
        });
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized: Task is not assigned to you' } },
          { status: 403 }
        );
      }

      teamMember = await TeamMember.findById(actorTeamMemberId);
      if (!teamMember || teamMember.status !== 'ACTIVE') {
        await AuditService.log({
          actor: actorEmail,
          action: 'CREDENTIAL_ACCESS_DENIED',
          entityType: 'Task',
          entityId: task._id,
          metadata: {
            taskId: task._id,
            credentialId,
            teamMemberId: actorTeamMemberId,
            reason: 'Team member record is not active',
          },
        });
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Your team member account is not active' } },
          { status: 403 }
        );
      }

      if (!TeamMemberService.hasPermission(teamMember, 'VIEW_CREDENTIALS')) {
        await AuditService.log({
          actor: actorEmail,
          action: 'CREDENTIAL_ACCESS_DENIED',
          entityType: 'Task',
          entityId: task._id,
          metadata: {
            taskId: task._id,
            credentialId,
            teamMemberId: teamMember._id,
            reason: 'Missing VIEW_CREDENTIALS permission',
          },
        });
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view credentials' } },
          { status: 403 }
        );
      }
    }

    // 5. Fetch Credential & Verify Existence & Active Status
    const cred = await Credential.findById(credentialId);
    if (!cred || cred.isRevoked) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CREDENTIAL_UNAVAILABLE',
            message: 'Credential no longer available or has been revoked',
          },
        },
        { status: 410 }
      );
    }

    // 6. Project Isolation Check
    if (!cred.projectId || cred.projectId.toString() !== task.projectId.toString()) {
      await AuditService.log({
        actor: actorEmail,
        action: 'CREDENTIAL_ACCESS_DENIED',
        entityType: 'Task',
        entityId: task._id,
        metadata: {
          taskId: task._id,
          taskProjectId: task.projectId,
          credentialId: cred._id,
          credProjectId: cred.projectId,
          reason: 'Project isolation violation: credential does not belong to task project',
        },
      });
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Credential does not belong to this project' } },
        { status: 403 }
      );
    }

    // 7. Check Current Credential Type Authorization at View Time
    if (teamMember && actorRole !== 'ADMIN') {
      const isAuthorized = TeamMemberService.isAuthorizedForCredentialType(teamMember, cred.credentialType);
      if (!isAuthorized) {
        await AuditService.log({
          actor: actorEmail,
          action: 'CREDENTIAL_ACCESS_DENIED',
          entityType: 'Credential',
          entityId: cred._id,
          metadata: {
            taskId: task._id,
            credentialId: cred._id,
            credentialType: cred.credentialType,
            teamMemberId: teamMember._id,
            reason: `Unauthorized for credential type: ${cred.credentialType || 'DEFAULT'}`,
          },
        });
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `You are not authorized to view ${cred.credentialType || 'this type of'} credentials`,
            },
          },
          { status: 403 }
        );
      }
    }

    // 8. Decrypt ONLY this specific credential
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
      console.error('Decryption failed for task credential:', decErr);
      return NextResponse.json(
        { success: false, error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt credential fields' } },
        { status: 500 }
      );
    }

    // 9. Audit Logging (NEVER log password or secrets)
    await AuditService.log({
      actor: actorEmail,
      action: 'CREDENTIAL_VIEWED',
      entityType: 'Credential',
      entityId: cred._id,
      metadata: {
        taskId: task._id,
        taskCode: task.taskCode,
        projectId: task.projectId,
        credentialId: cred._id,
        credentialType: cred.credentialType,
        teamMemberId: actorTeamMemberId || undefined,
        timestamp: new Date(),
        result: 'SUCCESS',
      },
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
    console.error('Error viewing task credential:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}
