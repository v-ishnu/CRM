import mongoose, { Schema, Document, Model } from 'mongoose';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ITaskAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export type SubmissionType = 'url' | 'file';

export interface ITaskSubmissionFile {
  name?: string;
  originalName?: string;
  fileName?: string;
  fileSize?: number;
  size?: number;
  storagePath: string;
  mimeType: string;
  uploadedAt?: Date;
}

export interface ITaskSubmission {
  submittedAt: Date;
  submittedBy: string | mongoose.Types.ObjectId;
  submittedByName?: string;
  note?: string;
  submissionNotes?: string;
  urls?: string[];
  submissionUrls?: string[];
  files?: ITaskSubmissionFile[];
  submissionFiles?: ITaskSubmissionFile[];
}

export interface ITask extends Document {
  taskCode: string;
  title: string;
  description?: string;
  clientId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  createdBy: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: Date;
  attachments?: ITaskAttachment[];
  requiredCredentialIds: mongoose.Types.ObjectId[];
  agreedAmount?: number;
  autoShareCredentials?: boolean;
  credentialAccessRevoked?: boolean;
  submissionRequired?: boolean;
  submissionTypes?: SubmissionType[];
  maxFileSizeMb?: number;
  submissionInstructions?: string;
  submission?: ITaskSubmission;
  submissionHistory?: ITaskSubmission[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    taskCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'TeamMember',
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'COMPLETED', 'CANCELLED'],
      default: 'TODO',
      required: true,
      index: true,
    },
    dueDate: {
      type: Date,
    },
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        size: { type: Number },
        type: { type: String },
      },
    ],
    requiredCredentialIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Credential',
        index: true,
      },
    ],
    agreedAmount: {
      type: Number,
      min: 0,
    },
    autoShareCredentials: {
      type: Boolean,
      default: false,
    },
    credentialAccessRevoked: {
      type: Boolean,
      default: false,
    },
    submissionRequired: {
      type: Boolean,
      default: false,
    },
    submissionTypes: {
      type: [String],
      enum: ['url', 'file'],
      default: ['url', 'file'],
    },
    maxFileSizeMb: {
      type: Number,
      default: 25,
    },
    submissionInstructions: {
      type: String,
      trim: true,
    },
    submission: {
      submittedAt: { type: Date },
      submittedBy: { type: Schema.Types.Mixed },
      submittedByName: { type: String, trim: true },
      note: { type: String, trim: true },
      submissionNotes: { type: String, trim: true },
      urls: [{ type: String, trim: true }],
      submissionUrls: [{ type: String, trim: true }],
      files: [{ type: Schema.Types.Mixed }],
      submissionFiles: [{ type: Schema.Types.Mixed }],
    },
    submissionHistory: [
      {
        submittedAt: { type: Date },
        submittedBy: { type: Schema.Types.Mixed },
        submittedByName: { type: String, trim: true },
        note: { type: String, trim: true },
        submissionNotes: { type: String, trim: true },
        urls: [{ type: String, trim: true }],
        submissionUrls: [{ type: String, trim: true }],
        files: [{ type: Schema.Types.Mixed }],
        submissionFiles: [{ type: Schema.Types.Mixed }],
      },
    ],
    completedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Task: Model<ITask> = 
  mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);

export default Task;
