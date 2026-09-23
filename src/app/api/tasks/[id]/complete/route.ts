import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/services/task.service';
import TeamMember from '@/models/TeamMember';
import { dbConnect } from '@/lib/db/connect';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();

  const actorEmail = req.headers.get('x-user-email') || 'system';
  const actorRole = req.headers.get('x-user-role') || 'ADMIN';
  let actorTeamMemberId = req.headers.get('x-team-member-id');

  try {
    const { id } = await params;

    if (actorRole !== 'ADMIN' && !actorTeamMemberId && actorEmail) {
      const member = await TeamMember.findOne({ email: actorEmail });
      if (member) {
        actorTeamMemberId = member._id.toString();
      }
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is allowed when submission is not required
    }

    const task = await TaskService.submitAndCompleteTask(
      id,
      body,
      actorEmail,
      actorRole,
      actorTeamMemberId || undefined
    );

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task completed successfully with submission',
    });
  } catch (error: any) {
    console.error('Task complete error:', error);
    const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json(
      {
        success: false,
        error: {
          code: statusCode === 403 ? 'FORBIDDEN' : 'VALIDATION_FAILED',
          message: error.message || 'Failed to complete task',
        },
      },
      { status: statusCode }
    );
  }
}
