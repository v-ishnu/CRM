import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/services/task.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;
    const clientId = searchParams.get('clientId') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const search = searchParams.get('search') || undefined;

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
  const actor = req.headers.get('x-user-email') || 'admin';
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
