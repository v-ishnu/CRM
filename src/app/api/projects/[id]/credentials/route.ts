import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Credential from '@/models/Credential';
import TeamMember from '@/models/TeamMember';
import { TeamMemberService } from '@/services/team-member.service';
import { decrypt } from '@/lib/security/encryption';
import mongoose from 'mongoose';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const teamMemberId = searchParams.get('teamMemberId');

    let authorizedMember: any = null;
    if (teamMemberId) {
      if (!mongoose.Types.ObjectId.isValid(teamMemberId)) {
        return NextResponse.json({ success: true, data: [] });
      }
      authorizedMember = await TeamMember.findById(teamMemberId);
      // If team member is inactive or lacks VIEW_CREDENTIALS, return empty
      if (
        !authorizedMember ||
        authorizedMember.status !== 'ACTIVE' ||
        !TeamMemberService.hasPermission(authorizedMember, 'VIEW_CREDENTIALS')
      ) {
        return NextResponse.json({ success: true, data: [] });
      }
    }

    const credentials = await Credential.find({
      projectId: id,
      isRevoked: { $ne: true },
    }).lean();

    // Filter by team member authorized credential types if teamMemberId was requested
    const filteredCredentials = authorizedMember
      ? credentials.filter((c: any) =>
          TeamMemberService.isAuthorizedForCredentialType(authorizedMember, c.credentialType)
        )
      : credentials;

    // Map to safe list: decrypt service type/name for admin display, never return password
    const safeCredentials = filteredCredentials.map((c: any) => {
      let serviceName = 'Credential';
      try {
        if (c.service) serviceName = decrypt(c.service);
      } catch {
        serviceName = 'Encrypted Service';
      }

      return {
        _id: c._id,
        service: serviceName,
        credentialType: c.credentialType,
        isRevoked: c.isRevoked,
        createdAt: c.createdAt,
      };
    });

    return NextResponse.json({ success: true, data: safeCredentials });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
