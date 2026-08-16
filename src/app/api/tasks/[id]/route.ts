import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/services/task.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const task = await TaskService.getTaskById(id);
    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: error.message } },
      { status: 404 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    const { id } = await params;
    const body = await req.json();
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
  try {
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
