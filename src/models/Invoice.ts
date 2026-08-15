import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  clientId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  invoiceDate: Date;
  dueDate?: Date;
  currency: string;
  items: IInvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  pdfPath?: string;
  pdfStoragePath?: string;
  pdfBucket?: string;
  telegramSent: boolean;
  emailSent: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>({
  description: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: [1, 'Quantity must be at least 1'],
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative'],
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative'],
  },
});

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
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
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    dueDate: {
      type: Date,
    },
    currency: {
      type: String,
      default: 'INR',
      required: true,
      uppercase: true,
    },
    items: {
      type: [InvoiceItemSchema],
      required: true,
      validate: [
        {
          validator: (arr: IInvoiceItem[]) => arr.length > 0,
          message: 'Invoice must contain at least one item',
        },
      ],
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative'],
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
      default: 'DRAFT',
      required: true,
    },
    pdfPath: {
      type: String,
    },
    pdfStoragePath: {
      type: String,
    },
    pdfBucket: {
      type: String,
    },
    telegramSent: {
      type: Boolean,
      default: false,
      required: true,
    },
    emailSent: {
      type: Boolean,
      default: false,
      required: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Invoice: Model<IInvoice> = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);

export default Invoice;
