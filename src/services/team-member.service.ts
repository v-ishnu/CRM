import crypto from 'crypto';
import mongoose from 'mongoose';
import TeamMember, { ITeamMember, TeamPermission, TeamRole } from '@/models/TeamMember';
import Project from '@/models/Project';
import Task from '@/models/Task';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

export interface CreateTeamMemberDTO {
  name: string;
  email: string;
  phone?: string;
  role?: TeamRole;
  telegramUserId?: string;
  telegramUsername?: string;
  permissions?: TeamPermission[];
  isPrimaryAdmin?: boolean;
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

    return enriched;
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

    return {
      ...member,
      assignedProjects: projects,
      assignedTasks: tasks,
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
