import { NextRequest, NextResponse } from 'next/server';
import Project from '@/models/Project';
import TeamMember from '@/models/TeamMember';
import { AuditService } from '@/services/audit.service';
import { dbConnect } from '@/lib/db/connect';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    await dbConnect();
    const { id, memberId } = await params;

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    const member = await TeamMember.findById(memberId);

    project.teamMemberIds = project.teamMemberIds || [];
    project.teamMemberIds = project.teamMemberIds.filter((mId) => mId.toString() !== memberId);
    await project.save();

    await AuditService.log({
      actor,
      action: 'PROJECT_TEAM_MEMBER_REMOVED',
      entityType: 'Project',
      entityId: project._id,
      metadata: {
        teamMemberId: memberId,
        teamMemberName: member?.name || memberId,
        projectName: project.name,
      },
    });

    return NextResponse.json({ success: true, message: 'Team member removed from project' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'REMOVAL_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
