import PDFDocument from 'pdfkit';
import Invoice, { IInvoice, IInvoiceItem } from '@/models/Invoice';
import Project from '@/models/Project';
import Client from '@/models/Client';
import Payment from '@/models/Payment';
import { AuditService } from './audit.service';
import { StorageService } from './storage.service';
import { dbConnect } from '@/lib/db/connect';

export class InvoiceService {
  /**
   * Safe sequence number generator (e.g. INV-2026-0001)
   */
  static async generateNextInvoiceNumber(): Promise<string> {
    await dbConnect();
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Find highest invoice number for current year
    const lastInvoice = await Invoice.findOne({
      invoiceNumber: new RegExp(`^${prefix}`),
    }).sort({ invoiceNumber: -1 });

    let nextSeq = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Create an invoice from items and project
   */
  static async createInvoice(
    invoiceData: {
      clientId: string;
      projectId: string;
      items: Omit<IInvoiceItem, 'amount'>[];
      tax?: number;
      discount?: number;
      dueDate?: Date;
      notes?: string;
    },
    actor: string
  ): Promise<IInvoice> {
    await dbConnect();

    const { clientId, projectId, items, tax = 0, discount = 0, dueDate, notes } = invoiceData;

    // Verify client and project
    const client = await Client.findById(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Process items and calculate totals
    const processedItems: IInvoiceItem[] = items.map((item) => {
      const quantity = item.quantity || 1;
      const unitPrice = item.unitPrice || 0;
      return {
        description: item.description,
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
      };
    });

    const subtotal = processedItems.reduce((sum, item) => sum + item.amount, 0);
    const total = Math.max(0, subtotal + tax - discount);

    const invoice = new Invoice({
      clientId,
      projectId,
      invoiceDate: new Date(),
      dueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days
      currency: project.currency,
      items: processedItems,
      subtotal,
      tax,
      discount,
      total,
      status: 'ISSUED', // Invoices created by admin start as ISSUED
      notes,
    });

    let attempts = 0;
    let savedInvoice: any = null;

    while (attempts < 5) {
      try {
        const invoiceNumber = await this.generateNextInvoiceNumber();
        invoice.invoiceNumber = invoiceNumber;
        invoice.pdfPath = `/api/invoices/${invoice._id}/pdf`;

        savedInvoice = await invoice.save();
        break; // Success
      } catch (err: any) {
        if (err.code === 11000 && attempts < 4) {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
          continue;
        }
        throw err;
      }
    }

    if (!savedInvoice) {
      throw new Error('Failed to create invoice due to concurrency conflict after 5 attempts');
    }

    // Generate the physical PDF
    await this.generatePDF(savedInvoice._id.toString());

    await AuditService.logAction(actor, 'INVOICE_CREATED', 'Invoice', savedInvoice._id, {
      invoiceNumber: savedInvoice.invoiceNumber,
      total: savedInvoice.total,
    });

    return savedInvoice;
  }

  /**
   * PDF generator engine using pdfkit
   */
  static async generatePDF(invoiceId: string): Promise<IInvoice> {
    await dbConnect();

    const invoice = await Invoice.findById(invoiceId)
      .populate('clientId')
      .populate('projectId');

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const client = invoice.clientId as any;
    const project = invoice.projectId as any;

    // Get company details from env with fallbacks
    const compName = process.env.COMPANY_NAME || 'Antigravity Development';
    const compAddress = process.env.COMPANY_ADDRESS || '123 Tech Park, Suite 400';
    const compEmail = process.env.COMPANY_EMAIL || 'billing@example.com';
    const compPhone = process.env.COMPANY_PHONE || '+1 (555) 019-9000';
    const compWebsite = process.env.COMPANY_WEBSITE || 'www.example.com';

    // Calculate total payments and remaining balance
    const payments = await Payment.find({
      invoiceId: invoice._id,
      status: 'COMPLETED',
    });
    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = Math.max(0, invoice.total - paidAmount);

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    return new Promise<IInvoice>((resolve, reject) => {
      doc.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });

      doc.on('error', (err) => {
        reject(err);
      });

      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          
          const year = new Date(invoice.invoiceDate).getFullYear();
          const storagePath = `invoices/${year}/${invoice.invoiceNumber}.pdf`;
          
          // Upload to Supabase Storage
          await StorageService.uploadInvoicePDF(pdfBuffer, storagePath);

          // Update MongoDB with storage paths
          invoice.pdfStoragePath = storagePath;
          invoice.pdfBucket = process.env.SUPABASE_INVOICE_BUCKET || 'invoices';
          invoice.pdfPath = `/api/invoices/${invoice._id}/pdf`;
          const savedInvoice = await invoice.save();

          resolve(savedInvoice);
        } catch (uploadError) {
          reject(uploadError);
        }
      });

      // Colors
      const primaryColor = '#1e1e2f';
      const secondaryColor = '#6366f1';
      const textColor = '#374151';
      const lightGray = '#f3f4f6';

      // Company Info Header
      doc.fillColor(primaryColor).fontSize(20).text(compName, 50, 50, { bold: true } as any);
      doc.fontSize(9).fillColor(textColor);
      doc.text(compAddress, 50, 75);
      doc.text(`Email: ${compEmail}  |  Phone: ${compPhone}`, 50, 90);
      doc.text(`Website: ${compWebsite}`, 50, 105);

      // INVOICE text right-aligned
      doc.fillColor(secondaryColor).fontSize(28).text('INVOICE', 400, 48, { align: 'right' } as any);

      doc.moveTo(50, 130).lineTo(550, 130).strokeColor(lightGray).lineWidth(1).stroke();

      // Meta Block: Invoice Date, Number
      doc.fillColor(textColor).fontSize(10);
      doc.text(`Invoice Number:`, 50, 150);
      doc.fillColor(primaryColor).text(invoice.invoiceNumber, 150, 150, { bold: true } as any);

      doc.fillColor(textColor).text(`Invoice Date:`, 50, 165);
      doc.text(new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 150, 165);

      doc.text(`Due Date:`, 50, 180);
      doc.text(invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'On Receipt', 150, 180);

      // Bill To & Project Info
      doc.fillColor(primaryColor).fontSize(12).text('Bill To:', 320, 150, { bold: true } as any);
      doc.fontSize(10).fillColor(textColor);
      doc.text(client.name, 320, 168);
      if (client.company) doc.text(client.company, 320, 182);
      doc.text(client.email, 320, 196);
      if (client.phone) doc.text(client.phone, 320, 210);
      if (client.address) doc.text(`${client.address}, ${client.city || ''}, ${client.state || ''}`, 320, 224);

      doc.moveTo(50, 250).lineTo(550, 250).strokeColor(lightGray).stroke();

      // Project context
      doc.fillColor(textColor).fontSize(10).text('Project:', 50, 265);
      doc.fillColor(primaryColor).text(project.name, 110, 265, { bold: true } as any);

      // Table Header
      let y = 300;
      doc.rect(50, y, 500, 22).fill(lightGray);
      doc.fillColor(primaryColor).fontSize(9);
      doc.text('Description', 60, y + 6, { bold: true } as any);
      doc.text('Qty', 350, y + 6, { width: 40, align: 'right', bold: true } as any);
      doc.text('Unit Price', 400, y + 6, { width: 70, align: 'right', bold: true } as any);
      doc.text('Amount', 480, y + 6, { width: 60, align: 'right', bold: true } as any);

      y += 22;

      // Table Body
      doc.fillColor(textColor).fontSize(9);
      for (const item of invoice.items) {
        doc.text(item.description, 60, y + 8, { width: 280 } as any);
        doc.text(item.quantity.toString(), 350, y + 8, { width: 40, align: 'right' } as any);
        doc.text(`${invoice.currency === 'INR' ? 'Rs. ' : '$ '}${item.unitPrice.toLocaleString('en-IN')}`, 400, y + 8, { width: 70, align: 'right' } as any);
        doc.text(`${invoice.currency === 'INR' ? 'Rs. ' : '$ '}${item.amount.toLocaleString('en-IN')}`, 480, y + 8, { width: 60, align: 'right' } as any);
        
        y += 28;
        doc.moveTo(50, y).lineTo(550, y).strokeColor(lightGray).lineWidth(0.5).stroke();
      }

      y += 10;

      // Summary block (right aligned)
      const labelX = 350;
      const valX = 480;

      doc.text('Subtotal:', labelX, y, { align: 'right', width: 120 } as any);
      doc.text(`${invoice.currency === 'INR' ? 'Rs. ' : '$ '}${invoice.subtotal.toLocaleString('en-IN')}`, valX, y, { align: 'right', width: 60 } as any);
      y += 18;

      if (invoice.tax > 0) {
        doc.text('Tax:', labelX, y, { align: 'right', width: 120 } as any);
        doc.text(`${invoice.currency === 'INR' ? 'Rs. ' : '$ '}${invoice.tax.toLocaleString('en-IN')}`, valX, y, { align: 'right', width: 60 } as any);
        y += 18;
      }

      if (invoice.discount > 0) {
        doc.text('Discount:', labelX, y, { align: 'right', width: 120 } as any);
        doc.text(`-${invoice.currency === 'INR' ? 'Rs. ' : '$ '}${invoice.discount.toLocaleString('en-IN')}`, valX, y, { align: 'right', width: 60 } as any);
        y += 18;
      }

      doc.font('Helvetica-Bold');
      doc.text('Total:', labelX, y, { align: 'right', width: 120 } as any);
      doc.text(`${invoice.currency === 'INR' ? 'Rs. ' : '$ '}${invoice.total.toLocaleString('en-IN')}`, valX, y, { align: 'right', width: 60 } as any);
      y += 22;

      doc.font('Helvetica');
      doc.fillColor(textColor);
      doc.text('Paid to Date:', labelX, y, { align: 'right', width: 120 } as any);
      doc.text(`${invoice.currency === 'INR' ? 'Rs. ' : '$ '}${paidAmount.toLocaleString('en-IN')}`, valX, y, { align: 'right', width: 60 } as any);
      y += 18;

      doc.font('Helvetica-Bold');
      doc.fillColor(primaryColor);
      doc.text('Balance Due:', labelX, y, { align: 'right', width: 120 } as any);
      doc.text(`${invoice.currency === 'INR' ? 'Rs. ' : '$ '}${balanceDue.toLocaleString('en-IN')}`, valX, y, { align: 'right', width: 60 } as any);
      y += 30;

      // Status block bottom-left
      doc.rect(50, y - 60, 160, 45).fill(lightGray);
      doc.fillColor(primaryColor).fontSize(8).text('INVOICE STATUS', 60, y - 54, { bold: true } as any);
      doc.fillColor(secondaryColor).fontSize(14).text(invoice.status, 60, y - 42, { bold: true } as any);

      // Thank you note
      doc.fontSize(9).fillColor(textColor);
      doc.text('Thank you for your business!', 50, 480, { align: 'center', width: 500 } as any);

      doc.end();
    });
  }

  /**
   * Query Invoices
   */
  static async queryInvoices(params: {
    clientId?: string;
    projectId?: string;
    status?: string;
    search?: string;
  }) {
    await dbConnect();
    const { clientId, projectId, status, search } = params;
    const query: Record<string, any> = {};

    if (clientId) query.clientId = clientId;
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { invoiceNumber: searchRegex },
      ];
    }

    const invoices = await Invoice.find(query)
      .populate('clientId', 'name company clientCode')
      .populate('projectId', 'name projectCode')
      .sort({ createdAt: -1 });

    return invoices;
  }
}
