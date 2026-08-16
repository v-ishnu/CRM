import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbConnect } from '@/lib/db/connect';
import DataRequest from '@/models/DataRequest';
import Client from '@/models/Client';
import Project from '@/models/Project';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';

const createRequestSchema = z.object({
  clientId: z.string(),
  projectId: z.string().optional(),
  type: z.enum(['GENERAL', 'CREDENTIAL', 'IMAGE', 'DOCUMENT', 'TEXT', 'CUSTOM']),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  credentialType: z.enum(['HOSTING', 'DOMAIN', 'WORDPRESS', 'FTP', 'SFTP', 'CPANEL', 'DATABASE', 'EMAIL', 'CLOUD', 'GITHUB', 'OTHER']).optional(),
  requiredFields: z.array(z.string()).optional(),
  expiresInHours: z.number().optional(),
  autoDeleteDays: z.number().optional(),
});

async function generateNextRequestId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  const lastRequest = await DataRequest.findOne({
    requestId: new RegExp(`^${prefix}`),
  }).sort({ requestId: -1 });

  let nextSeq = 1;
  if (lastRequest) {
    const parts = lastRequest.requestId.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

export async function POST(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  const actor = req.headers.get('x-user-email') || 'admin';

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied. Admin role required.' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const body = await req.json();
    const parsed = createRequestSchema.parse(body);

    const client = await Client.findById(parsed.clientId);
    if (!client) {
      return NextResponse.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      );
    }

    if (!client.telegramConnected || !client.telegramChatId) {
      return NextResponse.json(
        { success: false, error: { code: 'TELEGRAM_NOT_CONNECTED', message: 'Client has not connected their Telegram profile yet.' } },
        { status: 400 }
      );
    }

    let projectCode = '';
    if (parsed.projectId) {
      const project = await Project.findById(parsed.projectId);
      if (project) projectCode = project.projectCode;
    }

    const requestId = await generateNextRequestId();
    
    let expiresAt: Date | undefined;
    if (parsed.expiresInHours && parsed.expiresInHours > 0) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parsed.expiresInHours);
    }

    // Format the message template
    let icon = '📋';
    let typeName = 'Data Request';
    let formatBlock = '';

    if (parsed.type === 'CREDENTIAL') {
      icon = '🔐';
      typeName = 'Credential Request';
      const fields = parsed.requiredFields && parsed.requiredFields.length > 0
        ? parsed.requiredFields
        : ['Service', 'Username', 'Password', 'Login URL'];
      
      formatBlock = `\n\n<b>Please reply using this exact format:</b>\n\n<code>\n${fields.map(f => `${f}:`).join('\n')}\n</code>`;
    } else if (parsed.type === 'IMAGE') {
      icon = '🖼️';
      typeName = 'Image Request';
    } else if (parsed.type === 'DOCUMENT') {
      icon = '📁';
      typeName = 'Document Request';
    } else if (parsed.type === 'TEXT') {
      icon = '✍️';
      typeName = 'Text Request';
    }

    const telegramText = `${icon} <b>${typeName}</b>\n\n` +
      `Hello ${client.name},\n\n` +
      `Your project administrator has requested information for project <b>${projectCode || 'General'}</b>:\n\n` +
      `<b>${parsed.title}</b>\n\n` +
      `<i>Instructions:</i> ${parsed.message}` +
      `${formatBlock}\n\n` +
      `Request ID: <code>${requestId}</code>\n\n` +
      `<i>Please reply directly to this message or send the format above. Do not send credentials in normal chat outside this request.</i>`;

    // Dispatch Telegram message
    const sendResult = await TelegramService.sendMessageWithResult(client.telegramChatId, telegramText);
    
    const dataRequest = await DataRequest.create({
      requestId,
      clientId: parsed.clientId,
      projectId: parsed.projectId,
      type: parsed.type,
      title: parsed.title,
      message: parsed.message,
      credentialType: parsed.credentialType,
      requiredFields: parsed.requiredFields || [],
      status: sendResult.ok ? 'SENT' : 'PENDING',
      telegramDeliveryStatus: sendResult.ok ? 'SENT' : 'FAILED',
      telegramMessageId: sendResult.messageId,
      expiresAt,
      autoDeleteDays: parsed.autoDeleteDays,
    });

    // Create audit log
    const auditAction = parsed.type === 'CREDENTIAL' ? 'CREDENTIAL_REQUEST_SENT' : 'DATA_REQUEST_SENT';
    await AuditService.logAction(
      actor,
      auditAction,
      'DataRequest',
      dataRequest._id.toString(),
      {
        requestId,
        clientId: parsed.clientId,
        projectId: parsed.projectId,
        title: parsed.title,
      }
    );

    return NextResponse.json({ success: true, data: dataRequest });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    
    const query = clientId ? { clientId } : {};
    const requests = await DataRequest.find(query).sort({ createdAt: -1 });

    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
