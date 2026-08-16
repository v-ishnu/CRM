import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Project from '@/models/Project';
import TeamMember from '@/models/TeamMember';
import { AuditService } from '@/services/audit.service';
import { dbConnect } from '@/lib/db/connect';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'memberId is required' } },
        { status: 400 }
      );
    }

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    const member = await TeamMember.findById(memberId);
    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team member not found' } },
        { status: 404 }
      );
    }

    if (member.status === 'DEACTIVATED') {
      return NextResponse.json(
        { success: false, error: { code: 'DEACTIVATED_MEMBER', message: 'Cannot assign a deactivated team member' } },
        { status: 400 }
      );
    }

    project.teamMemberIds = project.teamMemberIds || [];
    const alreadyAssigned = project.teamMemberIds.some((mId) => mId.toString() === member._id.toString());
    if (!alreadyAssigned) {
      project.teamMemberIds.push(member._id as any);
      await project.save();

      await AuditService.log({
        actor,
        action: 'PROJECT_TEAM_MEMBER_ADDED',
        entityType: 'Project',
        entityId: project._id,
        metadata: {
          teamMemberId: member._id,
          teamMemberName: member.name,
          projectName: project.name,
        },
      });
    }

    return NextResponse.json({ success: true, data: project });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ASSIGNMENT_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
