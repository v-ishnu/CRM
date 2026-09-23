import mongoose, { Schema, Document, Model } from 'mongoose';

const EncryptedFieldSchema = new Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { _id: false }
);

export interface IEncryptedField {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface ICredential extends Document {
  requestId?: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  credentialType?: string;
  source: 'MANUAL' | 'CLIENT_REQUEST' | 'IMPORTED';
  service: IEncryptedField;
  username: IEncryptedField;
  password: IEncryptedField;
  loginUrl?: IEncryptedField;
  additionalInfo?: IEncryptedField;
  isRevoked?: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const CredentialSchema = new Schema<ICredential>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'DataRequest',
      required: false,
      unique: true,
      sparse: true,
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
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      index: true,
    },
    credentialType: {
      type: String,
      default: 'CUSTOM',
      trim: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['MANUAL', 'CLIENT_REQUEST', 'IMPORTED'],
      default: 'CLIENT_REQUEST',
      required: true,
      index: true,
    },
    service: {
      type: EncryptedFieldSchema,
      required: true,
    },
    username: {
      type: EncryptedFieldSchema,
      required: true,
    },
    password: {
      type: EncryptedFieldSchema,
      required: true,
    },
    loginUrl: {
      type: EncryptedFieldSchema,
    },
    additionalInfo: {
      type: EncryptedFieldSchema,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Credential: Model<ICredential> = mongoose.models.Credential || mongoose.model<ICredential>('Credential', CredentialSchema);

export default Credential;
