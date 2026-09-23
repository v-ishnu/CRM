import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import Task from '@/models/Task';
import TeamMember from '@/models/TeamMember';
import { StorageService } from '@/services/storage.service';
import { AuditService } from '@/services/audit.service';
import { dbConnect } from '@/lib/db/connect';

const ALLOWED_EXTENSIONS = new Set([
  '.zip', '.pdf', '.docx', '.doc', '.xlsx', '.xls',
  '.pptx', '.txt', '.png', '.jpg', '.jpeg', '.webp',
  '.csv', '.tar', '.gz', '.7z'
]);

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
    const task = await Task.findById(id);

    if (!task) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Authorization verification
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
              message: 'You are not authorized to upload deliverables for this task',
            },
          },
          { status: 403 }
        );
      }
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FILE', message: 'No file provided' } },
        { status: 400 }
      );
    }

    // Validate extension
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TYPE_NOT_ALLOWED',
            message: `File extension ${ext} is not allowed. Allowed types: ZIP, PDF, DOCX, XLSX, PPTX, TXT, CSV, images.`,
          },
        },
        { status: 400 }
      );
    }

    // Validate size limit
    const maxMb = task.maxFileSizeMb && task.maxFileSizeMb > 0 ? task.maxFileSizeMb : 25;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File size exceeds the allowed limit of ${maxMb}MB.`,
          },
        },
        { status: 400 }
      );
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `task-submissions/${task.projectId}/${task._id}/${Date.now()}_${sanitizedName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadedPath = await StorageService.uploadFile(
      buffer,
      storagePath,
      file.type || 'application/octet-stream'
    );

    const fileMeta = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      storagePath: uploadedPath || storagePath,
      uploadedAt: new Date(),
    };

    await AuditService.log({
      actor: actorEmail,
      action: 'TASK_SUBMISSION_FILE_UPLOADED',
      entityType: 'Task',
      entityId: task._id,
      metadata: {
        taskCode: task.taskCode,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    });

    return NextResponse.json({
      success: true,
      data: fileMeta,
    });
  } catch (error: any) {
    console.error('Task submission upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UPLOAD_FAILED', message: error.message || 'File upload failed' },
      },
      { status: 500 }
    );
  }
}
