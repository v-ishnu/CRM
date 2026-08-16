import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRequestFile {
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  telegramFileId: string;
  uploadedAt: Date;
}

const RequestFileSchema = new Schema(
  {
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    telegramFileId: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export interface IRequestResponse extends Document {
  requestId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  responseText?: string;
  files: IRequestFile[];
  receivedAt: Date;
}

const RequestResponseSchema = new Schema<IRequestResponse>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'DataRequest',
      required: true,
      unique: true,
      index: true,
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
      index: true,
    },
    responseText: {
      type: String,
    },
    files: {
      type: [RequestFileSchema],
      default: [],
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const RequestResponse: Model<IRequestResponse> = mongoose.models.RequestResponse || mongoose.model<IRequestResponse>('RequestResponse', RequestResponseSchema);

export default RequestResponse;
