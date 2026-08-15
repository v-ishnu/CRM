import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Please define MONGODB_URI in your .env file');
  process.exit(1);
}

// Import models via relative paths
import User from '../src/models/User';
import Client from '../src/models/Client';
import Project from '../src/models/Project';
import Payment from '../src/models/Payment';
import Invoice from '../src/models/Invoice';
import Notification from '../src/models/Notification';
import AuditLog from '../src/models/AuditLog';
import { InvoiceService } from '../src/services/invoice.service';

async function seed() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI!);
  console.log('Successfully connected to MongoDB.');

  // Clean collection databases
  console.log('Purging database collections...');
  await User.deleteMany({});
  await Client.deleteMany({});
  await Project.deleteMany({});
  await Payment.deleteMany({});
  await Invoice.deleteMany({});
  await Notification.deleteMany({});
  await AuditLog.deleteMany({});
  console.log('Collections cleared.');

  // 1. Create Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';
  const hashedPw = await bcrypt.hash(adminPassword, 12);

  const admin = new User({
    email: adminEmail,
    password: hashedPw,
    role: 'ADMIN',
    name: 'Administrator',
  });
  await admin.save();
  console.log(`Created Admin user: ${adminEmail}`);

  // Create Audit Log
  const initialAudit = new AuditLog({
    actor: 'system_seeder',
    action: 'CLIENT_CREATED', // Match enum constraints
    entityType: 'Auth',
    metadata: { info: 'System database seeded' },
    timestamp: new Date(),
  });
  await initialAudit.save();

  // 2. Seed Clients
  console.log('Seeding client records...');
  
  const client1 = new Client({
    clientCode: 'CL-0001',
    name: 'Rahul Sharma',
    email: 'rahul@example.com',
    phone: '+91 98765 43210',
    company: 'Sharma Tech Solutions',
    address: 'Sector 62, Block C',
    city: 'Noida',
    state: 'Uttar Pradesh',
    country: 'India',
    onboardingDate: new Date(),
    status: 'ACTIVE',
    notes: 'Likes updates via Telegram.',
  });
  await client1.save();

  const client2 = new Client({
    clientCode: 'CL-0002',
    name: 'Amit Kumar',
    email: 'amit@example.com',
    phone: '+91 87654 32109',
    company: 'Kumar Retailers',
    address: 'Connaught Place',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    onboardingDate: new Date(),
    status: 'ACTIVE',
  });
  await client2.save();

  const client3 = new Client({
    clientCode: 'CL-0003',
    name: 'Priya Singh',
    email: 'priya@example.com',
    phone: '+91 76543 21098',
    company: 'Singh Logistics',
    address: 'Salt Lake Sector V',
    city: 'Kolkata',
    state: 'West Bengal',
    country: 'India',
    onboardingDate: new Date(),
    status: 'LEAD',
    notes: 'Initial consultation done. Awaiting proposal.',
  });
  await client3.save();

  console.log('Seeded 3 clients.');

  // 3. Seed Projects
  console.log('Seeding projects...');

  const project1 = new Project({
    projectCode: 'PR-0001',
    clientId: client1._id,
    name: 'Business Website',
    description: 'Corporate business website development using Next.js and Tailwind CSS.',
    serviceType: 'WEBSITE',
    totalAmount: 50000,
    currency: 'INR',
    status: 'IN_PROGRESS',
    startDate: new Date(),
    expectedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  await project1.save();

  const project2 = new Project({
    projectCode: 'PR-0002',
    clientId: client2._id,
    name: 'E-Commerce App',
    description: 'Online store build with shopping cart and Razorpay gateway integration.',
    serviceType: 'ECOMMERCE',
    totalAmount: 120000,
    currency: 'INR',
    status: 'IN_PROGRESS',
    startDate: new Date(),
    expectedCompletionDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
  });
  await project2.save();

  const project3 = new Project({
    projectCode: 'PR-0003',
    clientId: client3._id,
    name: 'API Gateway Development',
    description: 'Custom microservice API gateway built with Node.js and Express.',
    serviceType: 'API_DEVELOPMENT',
    totalAmount: 80000,
    currency: 'INR',
    status: 'PLANNED',
  });
  await project3.save();

  console.log('Seeded 3 projects.');

  // 4. Seed Invoices
  console.log('Generating invoices...');

  const invoice1 = new Invoice({
    invoiceNumber: 'INV-2026-0001',
    clientId: client1._id,
    projectId: project1._id,
    invoiceDate: new Date(),
    dueDate: project1.expectedCompletionDate,
    currency: 'INR',
    items: [
      {
        description: 'Website Design & Frontend Development',
        quantity: 1,
        unitPrice: 50000,
        amount: 50000,
      },
    ],
    subtotal: 50000,
    tax: 0,
    discount: 0,
    total: 50000,
    status: 'PARTIALLY_PAID',
    pdfPath: '/invoices/INV-2026-0001.pdf',
    telegramSent: false,
    emailSent: false,
  });
  await invoice1.save();

  const invoice2 = new Invoice({
    invoiceNumber: 'INV-2026-0002',
    clientId: client2._id,
    projectId: project2._id,
    invoiceDate: new Date(),
    dueDate: project2.expectedCompletionDate,
    currency: 'INR',
    items: [
      {
        description: 'E-Commerce App Core Setup & Admin Panel',
        quantity: 1,
        unitPrice: 120000,
        amount: 120000,
      },
    ],
    subtotal: 120000,
    tax: 0,
    discount: 0,
    total: 120000,
    status: 'PARTIALLY_PAID',
    pdfPath: '/invoices/INV-2026-0002.pdf',
    telegramSent: false,
    emailSent: false,
  });
  await invoice2.save();

  const invoice3 = new Invoice({
    invoiceNumber: 'INV-2026-0003',
    clientId: client3._id,
    projectId: project3._id,
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    currency: 'INR',
    items: [
      {
        description: 'API Design Specifications & Mock Setup',
        quantity: 1,
        unitPrice: 80000,
        amount: 80000,
      },
    ],
    subtotal: 80000,
    tax: 0,
    discount: 0,
    total: 80000,
    status: 'ISSUED',
    pdfPath: '/invoices/INV-2026-0003.pdf',
    telegramSent: false,
    emailSent: false,
  });
  await invoice3.save();

  console.log('Seeded 3 invoice metadata entries.');

  // 5. Seed Payments
  console.log('Logging transactions...');

  const payment1 = new Payment({
    paymentNumber: 'PAY-2026-0001',
    clientId: client1._id,
    projectId: project1._id,
    invoiceId: invoice1._id,
    amount: 25000,
    currency: 'INR',
    paymentMethod: 'UPI',
    paymentDate: new Date(),
    transactionReference: 'UPI-982309489',
    status: 'COMPLETED',
    notes: 'Advance deposit.',
  });
  await payment1.save();

  const payment2 = new Payment({
    paymentNumber: 'PAY-2026-0002',
    clientId: client2._id,
    projectId: project2._id,
    invoiceId: invoice2._id,
    amount: 40000,
    currency: 'INR',
    paymentMethod: 'BANK_TRANSFER',
    paymentDate: new Date(),
    transactionReference: 'NEFT-KUMAR-ECOMM',
    status: 'COMPLETED',
  });
  await payment2.save();

  const payment3 = new Payment({
    paymentNumber: 'PAY-2026-0003',
    clientId: client2._id,
    projectId: project2._id,
    invoiceId: invoice2._id,
    amount: 30000,
    currency: 'INR',
    paymentMethod: 'UPI',
    paymentDate: new Date(),
    transactionReference: 'UPI-98129034',
    status: 'COMPLETED',
    notes: 'Second installment.',
  });
  await payment3.save();

  console.log('Seeded payments log.');

  // 6. Generate PDFs
  console.log('Rendering physical PDF documents via generator...');
  try {
    await InvoiceService.generatePDF(invoice1._id.toString());
    await InvoiceService.generatePDF(invoice2._id.toString());
    await InvoiceService.generatePDF(invoice3._id.toString());
    console.log('PDF documents generated in public/invoices/.');
  } catch (pdfErr) {
    console.error('Warning: PDF rendering encountered issues:', pdfErr);
  }

  // 7. Write Audit logs
  console.log('Writing seeder audit trials...');
  const audits = [
    { actor: 'system_seeder', action: 'CLIENT_CREATED', entityType: 'Client', entityId: client1._id },
    { actor: 'system_seeder', action: 'PROJECT_CREATED', entityType: 'Project', entityId: project1._id },
    { actor: 'system_seeder', action: 'INVOICE_CREATED', entityType: 'Invoice', entityId: invoice1._id },
    { actor: 'system_seeder', action: 'PAYMENT_CREATED', entityType: 'Payment', entityId: payment1._id },
    { actor: 'system_seeder', action: 'CLIENT_CREATED', entityType: 'Client', entityId: client2._id },
    { actor: 'system_seeder', action: 'PROJECT_CREATED', entityType: 'Project', entityId: project2._id },
    { actor: 'system_seeder', action: 'INVOICE_CREATED', entityType: 'Invoice', entityId: invoice2._id },
    { actor: 'system_seeder', action: 'PAYMENT_CREATED', entityType: 'Payment', entityId: payment2._id },
    { actor: 'system_seeder', action: 'PAYMENT_CREATED', entityType: 'Payment', entityId: payment3._id },
  ];

  for (const a of audits) {
    const log = new AuditLog({
      actor: a.actor,
      action: a.action as any,
      entityType: a.entityType as any,
      entityId: a.entityId,
      timestamp: new Date(),
    });
    await log.save();
  }

  console.log('Database seeding finished successfully.');
  await mongoose.connection.close();
}

seed().catch((err) => {
  console.error('Fatal: Database seeding failed:', err);
  process.exit(1);
});
