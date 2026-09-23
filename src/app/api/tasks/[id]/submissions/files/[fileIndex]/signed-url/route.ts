import { NextRequest, NextResponse } from 'next/server';
import Task from '@/models/Task';
import TeamMember from '@/models/TeamMember';
import { StorageService } from '@/services/storage.service';
import { dbConnect } from '@/lib/db/connect';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileIndex: string }> }
) {
  await dbConnect();

  const actorEmail = req.headers.get('x-user-email') || 'system';
  const actorRole = req.headers.get('x-user-role') || 'ADMIN';
  let actorTeamMemberId = req.headers.get('x-team-member-id');

  try {
    const { id, fileIndex } = await params;
    const task = await Task.findById(id);

    if (!task) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Check authorization: Admin or assigned team member
    if (actorRole !== 'ADMIN') {
      if (!actorTeamMemberId && actorEmail) {
        const member = await TeamMember.findOne({ email: actorEmail });
        if (member) {
          actorTeamMemberId = member._id.toString();
        }
      }

      if (!task.assignedTo || !actorTeamMemberId || task.assignedTo.toString() !== actorTeamMemberId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You are not authorized to access files for this task',
            },
          },
          { status: 403 }
        );
      }
    }

    const index = parseInt(fileIndex, 10);
    if (isNaN(index) || index < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INDEX', message: 'Invalid file index' } },
        { status: 400 }
      );
    }

    // Check if targeting a submission from history
    const searchParams = req.nextUrl.searchParams;
    const historyIndexParam = searchParams.get('historyIndex');

    let file: any;
    if (historyIndexParam !== null) {
      const hIdx = parseInt(historyIndexParam, 10);
      const historyItem = task.submissionHistory?.[hIdx];
      file = historyItem?.submissionFiles?.[index];
    } else {
      file = task.submission?.submissionFiles?.[index];
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Submission file not found' } },
        { status: 404 }
      );
    }

    const signedUrl = await StorageService.getSignedUrl(file.storagePath, 3600);

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.fileName,
        storagePath: file.storagePath,
        signedUrl,
        expiresIn: 3600,
      },
    });
  } catch (error: any) {
    console.error('Submission file signed-url error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SIGNED_URL_FAILED', message: error.message || 'Failed to generate signed URL' },
      },
      { status: 500 }
    );
  }
}
