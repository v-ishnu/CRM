import crypto from 'crypto';
import TeamMemberInvitation, { ITeamMemberInvitation } from '@/models/TeamMemberInvitation';
import TeamMember, { TeamRole } from '@/models/TeamMember';
import { TeamMemberService, BankDetailsInputDTO } from './team-member.service';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

export interface CreateInvitationDTO {
  role?: TeamRole;
  expiresInDays?: number;
}

export interface OnboardTeamMemberDTO {
  name: string;
  email: string;
  phone?: string;
  bankDetails?: BankDetailsInputDTO;
}

export class InvitationService {
  /**
   * Create a single-use cryptographically secure invitation link
   */
  static async createInvitation(
    data: CreateInvitationDTO,
    actor: string = 'admin'
  ): Promise<{
    invitation: ITeamMemberInvitation;
    rawToken: string;
    inviteUrl: string;
  }> {
    await dbConnect();

    // 32-byte cryptographically secure random token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const days = data.expiresInDays && data.expiresInDays > 0 ? data.expiresInDays : 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const invitation = new TeamMemberInvitation({
      tokenHash,
      role: data.role || 'DEVELOPER',
      status: 'PENDING',
      expiresAt,
      createdBy: actor,
    });

    await invitation.save();

    await AuditService.log({
      actor,
      action: 'INVITATION_CREATED',
      entityType: 'TeamMemberInvitation',
      entityId: invitation._id,
      metadata: {
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://crm.drdebuggers.com';
    const inviteUrl = `${appUrl}/team/invite/${rawToken}`;

    return {
      invitation,
      rawToken,
      inviteUrl,
    };
  }

  /**
   * Verify an invitation token (unhashed token passed from public URL)
   */
  static async verifyInvitationToken(rawToken: string): Promise<ITeamMemberInvitation> {
    await dbConnect();

    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('Invitation token is required');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const invitation = await TeamMemberInvitation.findOne({ tokenHash });

    if (!invitation) {
      throw new Error('Invalid invitation link');
    }

    if (invitation.status === 'REVOKED') {
      throw new Error('This invitation link has been revoked');
    }

    if (invitation.status === 'USED') {
      throw new Error('This invitation link has already been used');
    }

    if (invitation.expiresAt < new Date()) {
      if (invitation.status === 'PENDING') {
        invitation.status = 'EXPIRED';
        await invitation.save();
      }
      throw new Error('This invitation link has expired');
    }

    return invitation;
  }

  /**
   * Onboard a new team member using an invitation token
   */
  static async onboardTeamMember(
    rawToken: string,
    memberData: OnboardTeamMemberDTO
  ): Promise<{ teamMember: any; invitation: ITeamMemberInvitation }> {
    await dbConnect();

    const invitation = await this.verifyInvitationToken(rawToken);

    const email = memberData.email?.toLowerCase().trim();
    if (!email) {
      throw new Error('Email is required');
    }

    const existing = await TeamMember.findOne({ email });
    if (existing) {
      throw new Error(`A team member with email ${email} already exists`);
    }

    // Create team member with role specified in the invitation
    const teamMember = await TeamMemberService.createTeamMember(
      {
        name: memberData.name,
        email,
        phone: memberData.phone,
        role: invitation.role,
        bankDetails: memberData.bankDetails,
      },
      `onboarding:${email}`
    );

    // Mark invitation as used
    invitation.status = 'USED';
    invitation.usedAt = new Date();
    invitation.teamMemberId = teamMember._id as any;
    await invitation.save();

    await AuditService.log({
      actor: email,
      action: 'INVITATION_USED',
      entityType: 'TeamMemberInvitation',
      entityId: invitation._id,
      metadata: {
        teamMemberId: teamMember._id,
        email,
        role: invitation.role,
      },
    });

    return {
      teamMember,
      invitation,
    };
  }

  /**
   * Revoke a pending invitation link
   */
  static async revokeInvitation(id: string, actor: string = 'admin'): Promise<ITeamMemberInvitation> {
    await dbConnect();

    const invitation = await TeamMemberInvitation.findById(id);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error(`Cannot revoke an invitation with status ${invitation.status}`);
    }

    invitation.status = 'REVOKED';
    invitation.revokedAt = new Date();
    invitation.revokedBy = actor;
    await invitation.save();

    await AuditService.log({
      actor,
      action: 'INVITATION_REVOKED',
      entityType: 'TeamMemberInvitation',
      entityId: invitation._id,
      metadata: {
        role: invitation.role,
        createdBy: invitation.createdBy,
      },
    });

    return invitation;
  }

  /**
   * Get all invitations with optional filtering
   */
  static async getInvitations(filter: { status?: string } = {}): Promise<any[]> {
    await dbConnect();

    const query: any = {};
    if (filter.status) {
      query.status = filter.status;
    }

    const invitations = await TeamMemberInvitation.find(query)
      .populate('teamMemberId', 'name email role status')
      .sort({ createdAt: -1 })
      .lean();

    // Check expiry for any pending invitations
    const now = new Date();
    return invitations.map((inv) => {
      let status = inv.status;
      if (status === 'PENDING' && new Date(inv.expiresAt) < now) {
        status = 'EXPIRED';
      }
      return {
        ...inv,
        status,
        // Omit tokenHash for safety
        tokenHash: undefined,
      };
    });
  }
}
