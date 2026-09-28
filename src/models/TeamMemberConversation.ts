import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeamMemberConversation extends Document {
  adminId: mongoose.Types.ObjectId;
  teamMemberId: mongoose.Types.ObjectId;
  type: 'TEAM_MEMBER';
  status: 'OPEN' | 'CLOSED';
  lastMessageAt: Date;
  lastMessageText?: string;
  unreadAdminCount: number;
  unreadTeamMemberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberConversationSchema = new Schema<ITeamMemberConversation>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    teamMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamMember',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['TEAM_MEMBER'],
      default: 'TEAM_MEMBER',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      required: true,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessageText: {
      type: String,
      default: '',
      trim: true,
    },
    unreadAdminCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    unreadTeamMemberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal queries
TeamMemberConversationSchema.index({ teamMemberId: 1, status: 1 });
TeamMemberConversationSchema.index({ teamMemberId: 1, adminId: 1 });
TeamMemberConversationSchema.index({ lastMessageAt: -1 });

const TeamMemberConversation: Model<ITeamMemberConversation> =
  mongoose.models.TeamMemberConversation ||
  mongoose.model<ITeamMemberConversation>('TeamMemberConversation', TeamMemberConversationSchema);

export default TeamMemberConversation;
