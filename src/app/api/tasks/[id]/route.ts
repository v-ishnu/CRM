import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/services/task.service';
import Task from '@/models/Task';
import TeamMember from '@/models/TeamMember';
import { dbConnect } from '@/lib/db/connect';
import { verifyJWT } from '@/lib/auth/jwt';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();

    let sessionPayload = null;
    const sessionCookie = req.cookies.get('session')?.value;
    if (sessionCookie) {
      sessionPayload = await verifyJWT(sessionCookie);
    }

    const actorRole = sessionPayload?.role || req.headers.get('x-user-role') || 'MEMBER';
    const actorEmail = sessionPayload?.email || req.headers.get('x-user-email');
    let actorTeamMemberId = req.headers.get('x-team-member-id');

    const { id } = await params;
    const task = await TaskService.getTaskById(id);

    // IDOR Protection: Non-admin team member can only inspect tasks assigned to them
    if (actorRole !== 'ADMIN') {
      if (!actorTeamMemberId && actorEmail) {
        const member = await TeamMember.findOne({ email: actorEmail });
        if (member) {
          actorTeamMemberId = member._id.toString();
        }
      }

      const taskAssigneeId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
      if (!taskAssigneeId || !actorTeamMemberId || taskAssigneeId !== actorTeamMemberId.toString()) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized to view this task' } },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: error.message } },
      { status: 404 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let sessionPayload = null;
  const sessionCookie = req.cookies.get('session')?.value;
  if (sessionCookie) {
    sessionPayload = await verifyJWT(sessionCookie);
  }

  const actor = sessionPayload?.email || req.headers.get('x-user-email') || 'system';
  const actorRole = sessionPayload?.role || req.headers.get('x-user-role') || 'MEMBER';
  let actorTeamMemberId = req.headers.get('x-team-member-id');

  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    if (actorRole !== 'ADMIN') {
      const existingTask = await Task.findById(id);
      if (!existingTask) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
          { status: 404 }
        );
      }

      if (!actorTeamMemberId && actor) {
        const member = await TeamMember.findOne({ email: actor });
        if (member) {
          actorTeamMemberId = member._id.toString();
        }
      }

      // IDOR Protection: Team member can only update their own task
      if (!existingTask.assignedTo || !actorTeamMemberId || existingTask.assignedTo.toString() !== actorTeamMemberId.toString()) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized: You can only update tasks assigned to you' } },
          { status: 403 }
        );
      }

      // If task requires submission and has no submission yet, team member cannot directly set status to COMPLETED
      if (body.status === 'COMPLETED' && existingTask.submissionRequired && !existingTask.submission) {
        return NextResponse.json(
          { success: false, error: { code: 'SUBMISSION_REQUIRED', message: 'This task requires deliverables before it can be marked as completed' } },
          { status: 400 }
        );
      }

      // Team members must not reassign tasks, change compensation, or alter project/client associations
      if (body.assignedTo !== undefined || body.agreedAmount !== undefined || body.projectId !== undefined || body.clientId !== undefined) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized to reassign task, modify compensation, or change project linkage' } },
          { status: 403 }
        );
      }
    }

    const task = await TaskService.updateTask(id, body, actor);
    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const actorRole = req.headers.get('x-user-role') || 'ADMIN';

  if (actorRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required to delete tasks' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;
    await TaskService.deleteTask(id, actor);
    return NextResponse.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
