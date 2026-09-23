import mongoose, { Schema, Document, Model } from 'mongoose';
import { TeamRole } from './TeamMember';

export type InvitationStatus = 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';

export interface ITeamMemberInvitation extends Document {
  tokenHash: string;
  role: TeamRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdBy: string;
  usedAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  teamMemberId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberInvitationSchema = new Schema<ITeamMemberInvitation>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MANAGER', 'DEVELOPER', 'DESIGNER', 'SEO', 'OTHER'],
      default: 'DEVELOPER',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'USED', 'EXPIRED', 'REVOKED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
    usedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
    revokedBy: {
      type: String,
      trim: true,
    },
    teamMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamMember',
    },
  },
  {
    timestamps: true,
  }
);

const TeamMemberInvitation: Model<ITeamMemberInvitation> =
  mongoose.models.TeamMemberInvitation ||
  mongoose.model<ITeamMemberInvitation>('TeamMemberInvitation', TeamMemberInvitationSchema);

export default TeamMemberInvitation;
