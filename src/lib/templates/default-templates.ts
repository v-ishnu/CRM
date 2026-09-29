import { TemplateRecipientType, TemplateChannel, ITemplateVariable } from '@/models/MessageTemplate';

export interface DefaultTemplateDefinition {
  key: string;
  name: string;
  description: string;
  recipientType: TemplateRecipientType;
  channel: TemplateChannel;
  subject?: string;
  body: string;
  variables: ITemplateVariable[];
}

export const DEFAULT_MESSAGE_TEMPLATES: DefaultTemplateDefinition[] = [
  // ==========================================
  // TEAM MEMBER TEMPLATES
  // ==========================================
  {
    key: 'TEAM_MEMBER_TASK_ASSIGNED',
    name: 'Task Assigned Notification',
    description: 'Notification sent to a team member on Telegram when assigned to a task',
    recipientType: 'TEAM_MEMBER',
    channel: 'TELEGRAM',
    body: `🆕 <b>New Task Assigned</b>\n\n` +
      `<b>Project:</b>\n{{projectName}}\n\n` +
      `<b>Project Code:</b>\n<code>{{projectCode}}</code>\n\n` +
      `<b>Task:</b>\n{{taskTitle}}\n\n` +
      `<b>Task ID:</b>\n<code>{{taskCode}}</code>\n\n` +
      `<b>Priority:</b>\n{{priorityIcon}} {{priority}}\n\n` +
      `<b>Status:</b>\n<code>{{status}}</code>\n\n` +
      `<b>Due:</b>\n{{dueDate}}\n\n` +
      `<b>Description:</b>\n{{description}}\n\n` +
      `<b>Assigned by:</b>\n{{assignedBy}}`,
    variables: [
      { name: 'teamMemberName', description: 'Name of the assigned team member', sampleValue: 'John Doe' },
      { name: 'projectName', description: 'Name of the project', sampleValue: 'E-Commerce Redesign' },
      { name: 'projectCode', description: 'Project reference code', sampleValue: 'PRJ-8821' },
      { name: 'taskTitle', description: 'Title of the task', sampleValue: 'Fix Checkout Bug' },
      { name: 'taskCode', description: 'Task unique identifier code', sampleValue: 'TSK-1042' },
      { name: 'priority', description: 'Task priority (LOW, MEDIUM, HIGH, URGENT)', sampleValue: 'HIGH' },
      { name: 'priorityIcon', description: 'Priority icon/emoji', sampleValue: '🔴' },
      { name: 'status', description: 'Task status', sampleValue: 'ASSIGNED' },
      { name: 'dueDate', description: 'Formatted due date', sampleValue: '15 Oct 2026' },
      { name: 'description', description: 'Task description text', sampleValue: 'Resolve payment gateway callback error' },
      { name: 'assignedBy', description: 'Name of user who assigned the task', sampleValue: 'Admin' },
    ],
  },
  {
    key: 'TEAM_MEMBER_TASK_CREDENTIALS',
    name: 'Task Credentials Shared',
    description: 'Secure credentials list sent to team member for completing their assigned task',
    recipientType: 'TEAM_MEMBER',
    channel: 'TELEGRAM',
    body: `🔐 <b>Credentials for Task</b>\n\n` +
      `<b>Project:</b> {{projectName}} (<code>{{projectCode}}</code>)\n` +
      `<b>Task:</b> {{taskTitle}} (<code>{{taskCode}}</code>)\n` +
      `<b>Credentials Provided:</b> {{credentialsCount}}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `{{credentialsList}}\n` +
      `<b>Shared by:</b> {{sharedBy}}\n` +
      `{{confidentialNotice}}`,
    variables: [
      { name: 'teamMemberName', description: 'Team member name', sampleValue: 'John Doe' },
      { name: 'projectName', description: 'Project name', sampleValue: 'Client Portal' },
      { name: 'projectCode', description: 'Project code', sampleValue: 'PRJ-304' },
      { name: 'taskTitle', description: 'Task title', sampleValue: 'Configure Webhook' },
      { name: 'taskCode', description: 'Task code', sampleValue: 'TSK-205' },
      { name: 'credentialsCount', description: 'Count of credentials shared', sampleValue: '1' },
      { name: 'credentialsList', description: 'Formatted block of service, username, password and URL', sampleValue: '1. Required Access: WordPress\n   URL: https://example.com/wp-admin\n   Username: admin' },
      { name: 'sharedBy', description: 'Admin who shared access', sampleValue: 'Admin' },
      { name: 'confidentialNotice', description: 'Confidentiality reminder note', sampleValue: '⚠️ Confidential: Do not share.' },
    ],
  },
  {
    key: 'TEAM_MEMBER_PAYMENT_RECEIVED',
    name: 'Team Member Payment Recorded',
    description: 'Notification sent when a payout to a team member is recorded as paid',
    recipientType: 'TEAM_MEMBER',
    channel: 'TELEGRAM',
    body: `💰 <b>Payment Received</b>\n\n` +
      `Hello <b>{{teamMemberName}}</b>,\n` +
      `A payment has been recorded for your work.\n\n` +
      `<b>Project:</b> {{projectName}} (<code>{{projectCode}}</code>)\n` +
      `{{taskInfo}}` +
      `<b>Amount:</b> <b>{{amount}}</b>\n` +
      `<b>Payment Method:</b> {{paymentMethod}}\n` +
      `<b>Payment Date:</b> {{paymentDate}}\n` +
      `{{referenceInfo}}` +
      `<b>Status:</b> <b>PAID</b>\n\n` +
      `Thank you for your contributions!`,
    variables: [
      { name: 'teamMemberName', description: 'Team member name', sampleValue: 'John Doe' },
      { name: 'projectName', description: 'Project name', sampleValue: 'E-Commerce Website' },
      { name: 'projectCode', description: 'Project code', sampleValue: 'PRJ-901' },
      { name: 'taskInfo', description: 'Associated task details if task-linked', sampleValue: '<b>Task:</b> API Integration (<code>TSK-55</code>)\n' },
      { name: 'amount', description: 'Formatted payment amount', sampleValue: '₹12,500' },
      { name: 'paymentMethod', description: 'Payment method used', sampleValue: 'BANK_TRANSFER' },
      { name: 'paymentDate', description: 'Date payment was made', sampleValue: '29 Sep 2026' },
      { name: 'referenceInfo', description: 'Transaction reference or UTR line', sampleValue: '<b>Reference:</b> <code>UTR-88392019</code>\n' },
    ],
  },
  {
    key: 'TEAM_MEMBER_PAYMENT_CANCELLED',
    name: 'Team Member Payment Cancelled',
    description: 'Notification sent when a recorded team payment is marked cancelled',
    recipientType: 'TEAM_MEMBER',
    channel: 'TELEGRAM',
    body: `⚠️ <b>Payment Cancelled</b>\n\n` +
      `Hello <b>{{teamMemberName}}</b>,\n` +
      `Payment <code>{{paymentNumber}}</code> for <b>{{amount}}</b> (Project: <b>{{projectName}}</b>) has been marked as <b>CANCELLED</b>.`,
    variables: [
      { name: 'teamMemberName', description: 'Team member name', sampleValue: 'John Doe' },
      { name: 'paymentNumber', description: 'Payment record number', sampleValue: 'TPAY-0012' },
      { name: 'amount', description: 'Payment amount', sampleValue: '₹12,500' },
      { name: 'projectName', description: 'Project name', sampleValue: 'E-Commerce Website' },
    ],
  },
  {
    key: 'TEAM_MEMBER_CHAT_MESSAGE',
    name: 'Admin Chat Message to Team Member',
    description: 'Header format when Admin sends a message from CRM Chat composer to Telegram',
    recipientType: 'TEAM_MEMBER',
    channel: 'TELEGRAM',
    body: `⌯⌲ <b>Dr. Debuggers ({{adminName}}):</b>\n\n{{messageText}}`,
    variables: [
      { name: 'adminName', description: 'Name of the admin sender', sampleValue: 'Alex Admin' },
      { name: 'messageText', description: 'The rich text message content', sampleValue: 'Please review the updated requirements.' },
      { name: 'messageContent', description: 'The rich text message content (alias)', sampleValue: 'Please review the updated requirements.' },
    ],
  },

  // ==========================================
  // CLIENT TEMPLATES
  // ==========================================
  {
    key: 'CLIENT_ONBOARDED',
    name: 'Client Onboarding Welcome',
    description: 'Welcome message sent to client when their project is onboarded',
    recipientType: 'CLIENT',
    channel: 'TELEGRAM',
    body: `<b>🎉 Welcome!</b>\n\n` +
      `Hello {{clientName}},\n\n` +
      `Thank you for choosing us for your <b>{{projectName}}</b> project.\n\n` +
      `<b>Project:</b>\n{{projectName}}\n\n` +
      `<b>Total Project Amount:</b>\n{{currency}} {{totalAmount}}\n\n` +
      `{{paymentInfo}}\n\n` +
      `{{balanceInfo}}\n\n` +
      `<b>Invoice:</b>\n{{invoiceNumber}}\n\n` +
      `<b>Onboarding Date:</b>\n{{onboardingDate}}\n\n` +
      `Your project has been successfully onboarded.\n\n` +
      `Thank you.`,
    variables: [
      { name: 'clientName', description: 'Client contact name', sampleValue: 'Jane Smith' },
      { name: 'projectName', description: 'Project name', sampleValue: 'Corporate Portal' },
      { name: 'currency', description: 'Currency code or symbol', sampleValue: 'INR' },
      { name: 'totalAmount', description: 'Total agreed amount', sampleValue: '50,000' },
      { name: 'paymentInfo', description: 'Advance payment summary', sampleValue: 'Advance Payment Received:\nINR 25,000\n\nPayment:\n50% Advance' },
      { name: 'balanceInfo', description: 'Outstanding balance summary', sampleValue: 'Remaining Balance:\nINR 25,000' },
      { name: 'invoiceNumber', description: 'Onboarding invoice number', sampleValue: 'INV-2026-001' },
      { name: 'onboardingDate', description: 'Formatted onboarding date', sampleValue: '29 September 2026' },
    ],
  },
  {
    key: 'CLIENT_PAYMENT_RECEIVED',
    name: 'Client Payment Confirmation',
    description: 'Receipt notification sent to client when their payment is recorded',
    recipientType: 'CLIENT',
    channel: 'TELEGRAM',
    body: `💰 <b>Payment Received</b>\n\n` +
      `Hello {{clientName}},\n\n` +
      `We received your payment of:\n\n` +
      `<b>{{currency}}{{amount}}</b>\n\n` +
      `<b>Project:</b>\n{{projectName}}\n\n` +
      `<b>Project Total:</b>\n{{currency}}{{projectTotal}}\n\n` +
      `<b>Total Paid:</b>\n{{currency}}{{totalPaid}}\n\n` +
      `<b>Outstanding:</b>\n{{currency}}{{outstandingAmount}}\n\n` +
      `<b>Payment Status:</b>\n{{paymentStatus}}\n\n` +
      `<b>Receipt:</b>\n{{paymentNumber}}\n\n` +
      `Thank you.`,
    variables: [
      { name: 'clientName', description: 'Client name', sampleValue: 'Jane Smith' },
      { name: 'currency', description: 'Currency symbol', sampleValue: '₹' },
      { name: 'amount', description: 'Received amount', sampleValue: '25,000' },
      { name: 'projectName', description: 'Project name', sampleValue: 'Corporate Portal' },
      { name: 'projectTotal', description: 'Total project fee', sampleValue: '50,000' },
      { name: 'totalPaid', description: 'Cumulative paid to date', sampleValue: '25,000' },
      { name: 'outstandingAmount', description: 'Remaining balance', sampleValue: '25,000' },
      { name: 'paymentStatus', description: 'Status (PAID, PARTIALLY PAID)', sampleValue: 'PARTIALLY PAID' },
      { name: 'paymentNumber', description: 'Receipt/Payment record number', sampleValue: 'PAY-1002' },
    ],
  },
  {
    key: 'CLIENT_PROJECT_STATUS_UPDATE',
    name: 'Project Status Milestone Update',
    description: 'Notification sent to client when their project status changes',
    recipientType: 'CLIENT',
    channel: 'TELEGRAM',
    body: `<b>📢 Project Update</b>\n\n` +
      `Your <b>{{projectName}}</b> project has moved to:\n\n` +
      `<b>{{newStatus}}</b>\n\n` +
      `We are currently reviewing the completed implementation.\n\n` +
      `You will be notified about the next stage.`,
    variables: [
      { name: 'clientName', description: 'Client name', sampleValue: 'Jane Smith' },
      { name: 'projectName', description: 'Project name', sampleValue: 'Corporate Portal' },
      { name: 'newStatus', description: 'New project status name', sampleValue: 'REVIEW' },
    ],
  },
  {
    key: 'CLIENT_HOSTING_EXPIRY',
    name: 'Client Hosting Expiry Reminder',
    description: 'Warning sent to client when their domain/hosting is nearing renewal',
    recipientType: 'CLIENT',
    channel: 'TELEGRAM',
    body: `⚠️ <b>Hosting Expiry Reminder</b>\n\n` +
      `Your hosting for <b>{{domain}}</b> is expiring soon.\n\n` +
      `<b>Provider:</b> {{hostingProvider}}\n` +
      `<b>Expiry Date:</b> {{expiryDate}}\n` +
      `<b>Days Remaining:</b> {{daysRemaining}}\n\n` +
      `Please contact us if you want to renew the hosting service.`,
    variables: [
      { name: 'clientName', description: 'Client name', sampleValue: 'Jane Smith' },
      { name: 'domain', description: 'Domain name or project', sampleValue: 'example.com' },
      { name: 'hostingProvider', description: 'Hosting provider company', sampleValue: 'Hostinger' },
      { name: 'expiryDate', description: 'Formatted expiration date', sampleValue: '15 October 2026' },
      { name: 'daysRemaining', description: 'Days left before expiry', sampleValue: '7 days' },
    ],
  },
  {
    key: 'CLIENT_INVOICE_SENT',
    name: 'Client Invoice Dispatch Caption',
    description: 'Caption accompanying PDF invoice sent to client on Telegram',
    recipientType: 'CLIENT',
    channel: 'TELEGRAM',
    body: `📄 <b>Invoice {{invoiceNumber}}</b>\n` +
      `Amount: {{currency}} {{total}}\n` +
      `Due Date: {{dueDate}}\n` +
      `Status: <b>{{status}}</b>`,
    variables: [
      { name: 'clientName', description: 'Client name', sampleValue: 'Jane Smith' },
      { name: 'invoiceNumber', description: 'Invoice number', sampleValue: 'INV-2026-004' },
      { name: 'currency', description: 'Currency symbol', sampleValue: 'INR' },
      { name: 'total', description: 'Total invoice amount', sampleValue: '35,000' },
      { name: 'dueDate', description: 'Due date', sampleValue: '10 Oct 2026' },
      { name: 'status', description: 'Invoice status', sampleValue: 'ISSUED' },
    ],
  },

  // ==========================================
  // ADMIN TEMPLATES
  // ==========================================
  {
    key: 'ADMIN_TASK_STATUS_UPDATED',
    name: 'Admin Task Status Alert',
    description: 'Notification sent to Admin when team member updates task progress',
    recipientType: 'ADMIN',
    channel: 'TELEGRAM',
    body: `🔔 <b>Task Status Updated</b>\n\n` +
      `<b>Task:</b> {{taskTitle}} (<code>{{taskCode}}</code>)\n` +
      `<b>Status:</b> <code>{{oldStatus}}</code> ➔ <b>{{newStatus}}</b>\n` +
      `<b>Updated by:</b> {{changedBy}}`,
    variables: [
      { name: 'taskTitle', description: 'Task title', sampleValue: 'Implement Authentication' },
      { name: 'taskCode', description: 'Task code', sampleValue: 'TSK-102' },
      { name: 'oldStatus', description: 'Previous status', sampleValue: 'ASSIGNED' },
      { name: 'newStatus', description: 'New status', sampleValue: 'IN_PROGRESS' },
      { name: 'changedBy', description: 'Name/ID of team member who updated', sampleValue: 'John Doe' },
    ],
  },
  {
    key: 'ADMIN_TASK_SUBMISSION_RECEIVED',
    name: 'Admin Task Submission Alert',
    description: 'Notification sent to Admin when team member completes a task with work submission',
    recipientType: 'ADMIN',
    channel: 'TELEGRAM',
    body: `📋 <b>Task Completed with Submission</b>\n\n` +
      `<b>Task:</b> {{taskTitle}} (<code>{{taskCode}}</code>)\n` +
      `{{projectInfo}}` +
      `<b>Submitted by:</b> {{submitterName}}\n` +
      `{{notesSummary}}` +
      `{{urlsSummary}}` +
      `{{filesSummary}}\n\n` +
      `<a href="{{taskLink}}">View Task in Dashboard</a>`,
    variables: [
      { name: 'taskTitle', description: 'Task title', sampleValue: 'Fix Checkout Bug' },
      { name: 'taskCode', description: 'Task code', sampleValue: 'TSK-1042' },
      { name: 'projectInfo', description: 'Project name line if project-linked', sampleValue: '<b>Project:</b> E-Commerce Redesign\n' },
      { name: 'submitterName', description: 'Team member name who submitted', sampleValue: 'John Doe' },
      { name: 'notesSummary', description: 'Submission notes line', sampleValue: '<b>Notes:</b> Resolved Stripe webhook race condition\n' },
      { name: 'urlsSummary', description: 'Submitted URLs list', sampleValue: '<b>URLs:</b>\n• https://github.com/repo/pull/12\n' },
      { name: 'filesSummary', description: 'Submitted file attachments list', sampleValue: '<b>Files:</b>\n• <code>patch.zip</code> (1.2 MB, application/zip)' },
      { name: 'taskLink', description: 'URL link to view task in dashboard', sampleValue: 'https://crm.drdebuggers.com/dashboard/tasks?task=66' },
    ],
  },
  {
    key: 'ADMIN_HOSTING_EXPIRY_ALERT',
    name: 'Admin Hosting Expiry Alert',
    description: 'Daily alert to Admin when client hosting accounts are approaching expiry',
    recipientType: 'ADMIN',
    channel: 'TELEGRAM',
    body: `⚠️ <b>Hosting Expiry Alert</b>\n\n` +
      `<b>Client:</b> {{clientName}}\n` +
      `<b>Project:</b> {{projectName}}\n` +
      `<b>Provider:</b> {{hostingProvider}}\n` +
      `<b>Domain:</b> {{domain}}\n` +
      `<b>Expiry:</b> {{expiryDate}}\n` +
      `<b>Days Remaining:</b> {{daysRemaining}}\n` +
      `<b>Client Telegram:</b> {{clientTelegramStatus}}`,
    variables: [
      { name: 'clientName', description: 'Client name', sampleValue: 'Jane Smith' },
      { name: 'projectName', description: 'Project name', sampleValue: 'Corporate Portal' },
      { name: 'hostingProvider', description: 'Hosting provider', sampleValue: 'DigitalOcean' },
      { name: 'domain', description: 'Domain or IP', sampleValue: 'api.example.com' },
      { name: 'expiryDate', description: 'Expiry date', sampleValue: '15 October 2026' },
      { name: 'daysRemaining', description: 'Remaining days', sampleValue: '7 days' },
      { name: 'clientTelegramStatus', description: 'Client Telegram connection status', sampleValue: 'CONNECTED' },
    ],
  },
  {
    key: 'ADMIN_NEW_CHAT_MESSAGE_PUSH',
    name: 'Admin Web Push on Team Member Chat',
    description: 'Browser push notification when team member replies in chat',
    recipientType: 'ADMIN',
    channel: 'WEB_PUSH',
    subject: `💬 {{teamMemberName}}`,
    body: `{{messageSnippet}}`,
    variables: [
      { name: 'teamMemberName', description: 'Team member name', sampleValue: 'John Doe' },
      { name: 'messageSnippet', description: 'Snippet of incoming message', sampleValue: 'I have finished reviewing the API specs.' },
      { name: 'messageText', description: 'Message text (alias)', sampleValue: 'I have finished reviewing the API specs.' },
    ],
  },
  {
    key: 'ADMIN_TEAM_MESSAGE_PUSH',
    name: 'Admin Web Push Notification on Team Member Message',
    description: 'Browser push notification sent to the admin who owns the conversation',
    recipientType: 'ADMIN',
    channel: 'WEB_PUSH',
    subject: `💬 {{teamMemberName}}`,
    body: `{{messageText}}`,
    variables: [
      { name: 'teamMemberName', description: 'Team member name', sampleValue: 'John Doe' },
      { name: 'messageText', description: 'Message content from team member', sampleValue: 'Completed task verification.' },
      { name: 'messageSnippet', description: 'Snippet of message (alias)', sampleValue: 'Completed task verification.' },
    ],
  },
];
