import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProject extends Document {
  projectCode: string;
  clientId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  serviceType: 'WEBSITE' | 'WEB_APPLICATION' | 'MOBILE_APPLICATION' | 'API_DEVELOPMENT' | 'WORDPRESS' | 'ECOMMERCE' | 'MAINTENANCE' | 'OTHER';
  totalAmount: number;
  currency: string;
  status: 'PLANNED' | 'ONBOARDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  startDate?: Date;
  expectedCompletionDate?: Date;
  completionDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    projectCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    serviceType: {
      type: String,
      enum: ['WEBSITE', 'WEB_APPLICATION', 'MOBILE_APPLICATION', 'API_DEVELOPMENT', 'WORDPRESS', 'ECOMMERCE', 'MAINTENANCE', 'OTHER'],
      default: 'WEBSITE',
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      required: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['PLANNED', 'ONBOARDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED', 'ON_HOLD'],
      default: 'PLANNED',
      required: true,
    },
    startDate: {
      type: Date,
    },
    expectedCompletionDate: {
      type: Date,
    },
    completionDate: {
      type: Date,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
