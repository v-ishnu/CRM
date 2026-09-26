import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/services/task.service';
import TeamMember from '@/models/TeamMember';
import { dbConnect } from '@/lib/db/connect';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const actorRole = req.headers.get('x-user-role') || 'ADMIN';
    const actorTeamMemberId = req.headers.get('x-team-member-id');
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;
    const clientId = searchParams.get('clientId') || undefined;
    let assignedTo = searchParams.get('assignedTo') || undefined;
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const search = searchParams.get('search') || undefined;

    // Enforce role-based isolation: Non-admin team members can only access their own tasks
    if (actorRole !== 'ADMIN' && actorTeamMemberId) {
      assignedTo = actorTeamMemberId;
    }

    const data = await TaskService.getTasks({
      projectId,
      clientId,
      assignedTo,
      status,
      priority,
      search,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const actor = req.headers.get('x-user-email') || 'admin';
  const actorRole = req.headers.get('x-user-role') || 'ADMIN';
  const actorTeamMemberId = req.headers.get('x-team-member-id');

  if (actorRole !== 'ADMIN') {
    let hasPermission = false;
    if (actorTeamMemberId) {
      const member = await TeamMember.findById(actorTeamMemberId);
      if (member && member.permissions?.includes('MANAGE_TASKS')) {
        hasPermission = true;
      }
    }
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin or MANAGE_TASKS permission required to create tasks' } },
        { status: 403 }
      );
    }
  }

  try {
    const body = await req.json();
    const task = await TaskService.createTask(body, actor);
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'TASK_CREATE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
