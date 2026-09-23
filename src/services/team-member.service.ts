import crypto from 'crypto';
import mongoose from 'mongoose';
import TeamMember, { ITeamMember, TeamPermission, TeamRole, IBankDetails } from '@/models/TeamMember';
import Project from '@/models/Project';
import Task from '@/models/Task';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

export interface BankDetailsInputDTO {
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
}

export interface CreateTeamMemberDTO {
  name: string;
  email: string;
  phone?: string;
  role?: TeamRole;
  telegramUserId?: string;
  telegramUsername?: string;
  permissions?: TeamPermission[];
  isPrimaryAdmin?: boolean;
  bankDetails?: BankDetailsInputDTO;
}

export interface UpdateTeamMemberDTO {
  name?: string;
  email?: string;
  phone?: string;
  role?: TeamRole;
  telegramUserId?: string;
  telegramUsername?: string;
  permissions?: TeamPermission[];
  status?: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';
  bankDetails?: BankDetailsInputDTO;
}

export class TeamMemberService {
  /**
   * Create a new team member
   */
  static async createTeamMember(data: CreateTeamMemberDTO, actor: string = 'system'): Promise<ITeamMember> {
    await dbConnect();

    const email = data.email.toLowerCase().trim();
    const existing = await TeamMember.findOne({ email });
    if (existing) {
      throw new Error(`Team member with email ${email} already exists`);
    }

    const defaultPermissions: TeamPermission[] = data.permissions && data.permissions.length > 0 
      ? data.permissions 
      : (data.role === 'ADMIN' 
          ? ['VIEW_CREDENTIALS', 'REQUEST_CREDENTIALS', 'MANAGE_TASKS', 'VIEW_PROJECT', 'VIEW_CLIENT', 'MANAGE_PROJECT', 'VIEW_TASKS']
          : ['VIEW_PROJECT', 'VIEW_TASKS']);

    const bankDetails = this.buildEncryptedBankDetails(data.bankDetails);

    const teamMember = new TeamMember({
      name: data.name.trim(),
      email,
      phone: data.phone?.trim(),
      role: data.role || 'DEVELOPER',
      telegramUserId: data.telegramUserId?.trim(),
      telegramUsername: data.telegramUsername?.trim(),
      telegramConnected: !!data.telegramUserId,
      status: 'ACTIVE',
      permissions: defaultPermissions,
      isPrimaryAdmin: data.isPrimaryAdmin || false,
      bankDetails,
    });

    await teamMember.save();

    await AuditService.log({
      actor,
      action: 'TEAM_MEMBER_CREATED',
      entityType: 'TeamMember',
      entityId: teamMember._id,
      metadata: {
        name: teamMember.name,
        email: teamMember.email,
        role: teamMember.role,
        permissions: teamMember.permissions,
        hasBankDetails: !!bankDetails?.isComplete,
      },
    });

    return teamMember;
  }

  /**
   * Update an existing team member
   */
  static async updateTeamMember(id: string, data: UpdateTeamMemberDTO, actor: string = 'system'): Promise<ITeamMember> {
    await dbConnect();

    const teamMember = await TeamMember.findById(id);
    if (!teamMember) {
      throw new Error('Team member not found');
    }

    if (data.email && data.email.toLowerCase().trim() !== teamMember.email) {
      const email = data.email.toLowerCase().trim();
      const existing = await TeamMember.findOne({ email, _id: { $ne: id } });
      if (existing) {
        throw new Error(`Email ${email} is already in use by another team member`);
      }
      teamMember.email = email;
    }

    if (data.name !== undefined) teamMember.name = data.name.trim();
    if (data.phone !== undefined) teamMember.phone = data.phone?.trim();
    if (data.role !== undefined) teamMember.role = data.role;
    if (data.telegramUserId !== undefined) {
      teamMember.telegramUserId = data.telegramUserId.trim() || undefined;
      teamMember.telegramConnected = !!teamMember.telegramUserId;
    }
    if (data.telegramUsername !== undefined) teamMember.telegramUsername = data.telegramUsername.trim() || undefined;
    if (data.permissions !== undefined) teamMember.permissions = data.permissions;
    if (data.status !== undefined) teamMember.status = data.status;

    if (data.bankDetails !== undefined) {
      teamMember.bankDetails = this.buildEncryptedBankDetails(data.bankDetails, teamMember.bankDetails);
      await AuditService.log({
        actor,
        action: 'BANK_DETAILS_UPDATED',
        entityType: 'TeamMember',
        entityId: teamMember._id,
        metadata: {
          isComplete: teamMember.bankDetails?.isComplete,
        },
      });
    }

    await teamMember.save();

    await AuditService.log({
      actor,
      action: 'TEAM_MEMBER_UPDATED',
      entityType: 'TeamMember',
      entityId: teamMember._id,
      metadata: {
        name: teamMember.name,
        role: teamMember.role,
        status: teamMember.status,
        permissions: teamMember.permissions,
      },
    });

    return teamMember;
  }

  /**
   * Deactivate a team member
   */
  static async deactivateTeamMember(id: string, actor: string = 'system'): Promise<ITeamMember> {
    await dbConnect();

    const teamMember = await TeamMember.findById(id);
    if (!teamMember) {
      throw new Error('Team member not found');
    }

    if (teamMember.isPrimaryAdmin) {
      throw new Error('Primary admin account cannot be deactivated');
    }

    teamMember.status = 'DEACTIVATED';
    await teamMember.save();

    await AuditService.log({
      actor,
      action: 'TEAM_MEMBER_DEACTIVATED',
      entityType: 'TeamMember',
      entityId: teamMember._id,
      metadata: {
        name: teamMember.name,
        email: teamMember.email,
      },
    });

    return teamMember;
  }

  /**
   * Delete or soft-remove a team member
   */
  static async deleteTeamMember(id: string, actor: string = 'system'): Promise<boolean> {
    await dbConnect();

    const teamMember = await TeamMember.findById(id);
    if (!teamMember) {
      throw new Error('Team member not found');
    }

    if (teamMember.isPrimaryAdmin) {
      throw new Error('Primary admin account cannot be deleted');
    }

    // Remove active project team assignments
    await Project.updateMany(
      { teamMemberIds: teamMember._id },
      { $pull: { teamMemberIds: teamMember._id } }
    );

    // Reassign or unassign tasks (keep history intact)
    await Task.updateMany(
      { assignedTo: teamMember._id, status: { $nin: ['COMPLETED', 'CANCELLED'] } },
      { $unset: { assignedTo: 1 } }
    );

    await TeamMember.deleteOne({ _id: id });

    await AuditService.log({
      actor,
      action: 'TEAM_MEMBER_DELETED',
      entityType: 'TeamMember',
      entityId: id,
      metadata: {
        name: teamMember.name,
        email: teamMember.email,
      },
    });

    return true;
  }

  /**
   * Generate a secure single-use Telegram connection token
   */
  static async generateTelegramConnectionToken(id: string, actor: string = 'system'): Promise<{ token: string; link: string }> {
    await dbConnect();

    const teamMember = await TeamMember.findById(id);
    if (!teamMember) {
      throw new Error('Team member not found');
    }

    if (teamMember.status === 'DEACTIVATED') {
      throw new Error('Cannot generate connection token for a deactivated team member');
    }

    // Generate random 32-char uppercase alphanumeric token
    const randomHex = crypto.randomBytes(16).toString('hex').toUpperCase();
    const token = `TEAM_${randomHex}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours validity

    teamMember.telegramConnectionToken = token;
    teamMember.telegramTokenExpiresAt = expiresAt;
    await teamMember.save();

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Dr_DebuggersBot';
    const link = `https://t.me/${botUsername}?start=${token}`;

    return { token, link };
  }

  /**
   * Connect a Telegram account using a deep-link token
   */
  static async connectTelegram(
    token: string,
    telegramData: { telegramUserId: string; telegramUsername?: string; telegramChatId: string }
  ): Promise<ITeamMember> {
    await dbConnect();

    const member = await TeamMember.findOne({
      telegramConnectionToken: token,
      telegramTokenExpiresAt: { $gt: new Date() },
    });

    if (!member) {
      throw new Error('Invalid or expired team connection token');
    }

    if (member.status === 'DEACTIVATED') {
      throw new Error('This team member account has been deactivated');
    }

    // Clear the one-time token immediately to guarantee single-use!
    member.telegramUserId = String(telegramData.telegramUserId);
    if (telegramData.telegramUsername) {
      member.telegramUsername = telegramData.telegramUsername;
    }
    member.telegramChatId = String(telegramData.telegramChatId);
    member.telegramConnected = true;
    member.telegramConnectionToken = undefined;
    member.telegramTokenExpiresAt = undefined;

    await member.save();

    await AuditService.log({
      actor: member.name,
      action: 'TEAM_MEMBER_CONNECTED_TELEGRAM',
      entityType: 'TeamMember',
      entityId: member._id,
      metadata: {
        telegramUserId: member.telegramUserId,
        telegramUsername: member.telegramUsername,
      },
    });

    return member;
  }

  /**
   * Get all team members with optional filtering
   */
  static async getTeamMembers(filter: { role?: string; status?: string; search?: string } = {}): Promise<any[]> {
    await dbConnect();

    const query: any = {};
    if (filter.role) query.role = filter.role;
    if (filter.status) query.status = filter.status;
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { email: { $regex: filter.search, $options: 'i' } },
        { phone: { $regex: filter.search, $options: 'i' } },
      ];
    }

    const members = await TeamMember.find(query).sort({ createdAt: -1 }).lean();

    // Enrich with active tasks count and assigned projects count
    const enriched = await Promise.all(
      members.map(async (m) => {
        const [projectsCount, activeTasksCount] = await Promise.all([
          Project.countDocuments({ teamMemberIds: m._id }),
          Task.countDocuments({ assignedTo: m._id, status: { $nin: ['COMPLETED', 'CANCELLED'] } }),
        ]);

        return {
          ...m,
          projectsCount,
          activeTasksCount,
        };
      })
    );

    return enriched.map((m) => this.sanitizeBankDetails(m));
  }

  /**
   * Get single team member by ID with assigned projects & tasks
   */
  static async getTeamMemberById(id: string): Promise<any> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid team member ID format');
    }

    const member = await TeamMember.findById(id).lean();
    if (!member) {
      throw new Error('Team member not found');
    }

    const [projects, tasks] = await Promise.all([
      Project.find({ teamMemberIds: member._id }).select('projectCode name serviceType status totalAmount').lean(),
      Task.find({ assignedTo: member._id }).populate('projectId', 'name projectCode').sort({ dueDate: 1 }).lean(),
    ]);

    return this.sanitizeBankDetails({
      ...member,
      assignedProjects: projects,
      assignedTasks: tasks,
    });
  }

  /**
   * Helper to sanitize bank details (strips encrypted ciphertext, iv, authTag from response)
   */
  static sanitizeBankDetails(member: any): any {
    if (!member || !member.bankDetails) return member;
    const sanitized = { ...member };
    const { accountNumberEncrypted: _a, ifscEncrypted: _i, upiIdEncrypted: _u, ...safeBank } = member.bankDetails;
    sanitized.bankDetails = safeBank;
    return sanitized;
  }

  /**
   * Encrypt and mask bank details input
   */
  static buildEncryptedBankDetails(
    input?: BankDetailsInputDTO,
    existing?: IBankDetails
  ): IBankDetails | undefined {
    if (!input) return existing;

    const result: IBankDetails = existing
      ? { ...existing }
      : { isComplete: false };

    if (input.accountHolderName !== undefined) {
      result.accountHolderName = input.accountHolderName.trim();
    }
    if (input.bankName !== undefined) {
      result.bankName = input.bankName.trim();
    }

    if (input.accountNumber !== undefined) {
      const acc = input.accountNumber.trim();
      if (acc) {
        result.accountNumberEncrypted = encrypt(acc, 'accountNumber');
        const last4 = acc.length >= 4 ? acc.slice(-4) : acc;
        result.accountNumberMasked = `•••• •••• ${last4}`;
      } else {
        result.accountNumberEncrypted = undefined;
        result.accountNumberMasked = undefined;
      }
    }

    if (input.ifsc !== undefined) {
      const ifsc = input.ifsc.trim().toUpperCase();
      if (ifsc) {
        result.ifscEncrypted = encrypt(ifsc, 'ifsc');
        const first4 = ifsc.length >= 4 ? ifsc.slice(0, 4) : ifsc;
        result.ifscMasked = `${first4}•••••••`;
      } else {
        result.ifscEncrypted = undefined;
        result.ifscMasked = undefined;
      }
    }

    if (input.upiId !== undefined) {
      const upi = input.upiId.trim();
      if (upi) {
        result.upiIdEncrypted = encrypt(upi, 'upiId');
        if (upi.includes('@')) {
          const [handle, domain] = upi.split('@');
          const prefix = handle.length > 2 ? handle.slice(0, 2) : handle.slice(0, 1);
          result.upiIdMasked = `${prefix}••••@${domain}`;
        } else {
          result.upiIdMasked = `${upi.slice(0, 2)}••••`;
        }
      } else {
        result.upiIdEncrypted = undefined;
        result.upiIdMasked = undefined;
      }
    }

    result.isComplete = !!(
      result.accountHolderName &&
      result.accountNumberMasked &&
      result.ifscMasked
    );
    result.updatedAt = new Date();

    return result;
  }

  /**
   * Reveal decrypted bank details for authorized admin
   */
  static async revealBankDetails(
    id: string,
    actor: string = 'system'
  ): Promise<{
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
    isComplete: boolean;
  }> {
    await dbConnect();

    const member = await TeamMember.findById(id);
    if (!member) {
      throw new Error('Team member not found');
    }

    if (!member.bankDetails) {
      throw new Error('No bank details on file for this team member');
    }

    let accountNumber: string | undefined;
    let ifsc: string | undefined;
    let upiId: string | undefined;

    if (member.bankDetails.accountNumberEncrypted) {
      try {
        accountNumber = decrypt(member.bankDetails.accountNumberEncrypted as any);
      } catch (err: any) {
        console.warn('Failed to decrypt account number:', err);
      }
    }
    if (member.bankDetails.ifscEncrypted) {
      try {
        ifsc = decrypt(member.bankDetails.ifscEncrypted as any);
      } catch (err: any) {
        console.warn('Failed to decrypt IFSC:', err);
      }
    }
    if (member.bankDetails.upiIdEncrypted) {
      try {
        upiId = decrypt(member.bankDetails.upiIdEncrypted as any);
      } catch (err: any) {
        console.warn('Failed to decrypt UPI ID:', err);
      }
    }

    await AuditService.log({
      actor,
      action: 'BANK_DETAILS_REVEALED',
      entityType: 'TeamMember',
      entityId: member._id,
      metadata: {
        memberEmail: member.email,
        memberName: member.name,
      },
    });

    return {
      accountHolderName: member.bankDetails.accountHolderName,
      bankName: member.bankDetails.bankName,
      accountNumber,
      ifsc,
      upiId,
      isComplete: member.bankDetails.isComplete,
    };
  }

  /**
   * Helper to check permissions
   */
  static hasPermission(member: ITeamMember, permission: TeamPermission): boolean {
    if (member.role === 'ADMIN' || member.isPrimaryAdmin) return true;
    return member.permissions && member.permissions.includes(permission);
  }
}
