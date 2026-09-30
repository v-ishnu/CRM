import { NextRequest, NextResponse } from 'next/server';
import { TeamChatService } from '@/services/team-chat.service';
import { verifyJWT } from '@/lib/auth/jwt';
import User from '@/models/User';

async function getAdminUser(req: NextRequest) {
  let userId = req.headers.get('x-user-id');
  let userEmail = req.headers.get('x-user-email');
  let userName = req.headers.get('x-user-name');
  let userRole = req.headers.get('x-user-role');

  if (!userId) {
    const sessionCookie = req.cookies.get('session')?.value;
    if (sessionCookie) {
      const payload = await verifyJWT(sessionCookie);
      if (payload) {
        userId = payload.id;
        userEmail = payload.email;
        userName = payload.name;
        userRole = payload.role;
      }
    }
  }

  if (!userId) {
    const defaultAdmin = await User.findOne({ role: 'ADMIN' });
    if (defaultAdmin) {
      userId = defaultAdmin._id.toString();
      userEmail = defaultAdmin.email;
      userName = defaultAdmin.name;
      userRole = defaultAdmin.role;
    }
  }

  return {
    id: userId || 'admin',
    email: userEmail || 'admin@example.com',
    name: userName || 'Admin',
    role: userRole || 'ADMIN',
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const adminUser = await getAdminUser(req);

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');

    if (after) {
      const incremental = await TeamChatService.getIncrementalMessages(id, after);
      return NextResponse.json({ success: true, data: incremental });
    }

    const conversationId = searchParams.get('conversationId') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await TeamChatService.getConversationMessages(id, adminUser, { page, limit, conversationId });
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      { success: false, error: { code: 'CHAT_FETCH_FAILED', message: error.message } },
      { status }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const adminUser = await getAdminUser(req);
    const contentType = req.headers.get('content-type') || '';

    let text = '';
    let attachments: any[] | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      text = ((formData.get('text') || formData.get('message')) as string) || '';
      const file = formData.get('file') as File | null;

      if (file && typeof file.arrayBuffer === 'function') {
        const arrayBuf = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const mimeType = file.type || 'application/octet-stream';
        const isImage = mimeType.startsWith('image/');
        const type: 'IMAGE' | 'FILE' = isImage ? 'IMAGE' : 'FILE';

        attachments = [
          {
            type,
            originalName: file.name || (isImage ? 'image.jpg' : 'file.dat'),
            mimeType,
            size: file.size || buffer.length,
            buffer,
          },
        ];
      }
    } else {
      const body = await req.json();
      text = body.text || body.message || '';
      attachments = body.attachments;
    }

    if (!text.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Message text or attachment is required' } },
        { status: 400 }
      );
    }

    const result = await TeamChatService.sendMessageFromAdmin({
      teamMemberId: id,
      text: text.trim(),
      adminUser,
      attachments,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const isNotFound = error.message?.includes('not found');
    const isDeactivated = error.message?.includes('deactivated');
    const isTelegramNotConnected = error.message?.includes('Telegram not connected');

    let code = 'SEND_MESSAGE_FAILED';
    if (isNotFound) code = 'NOT_FOUND';
    else if (isDeactivated) code = 'DEACTIVATED';
    else if (isTelegramNotConnected) code = 'TELEGRAM_NOT_CONNECTED';

    const status = isNotFound ? 404 : 400;
    return NextResponse.json(
      { success: false, error: { code, message: error.message } },
      { status }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const adminUser = await getAdminUser(req);
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');
    const clearAll = searchParams.get('clearAll') === 'true';

    if (messageId) {
      const result = await TeamChatService.deleteMessage(messageId, id, adminUser);
      return NextResponse.json({ success: true, data: result });
    }

    if (clearAll) {
      const result = await TeamChatService.clearConversation(id, adminUser);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Specify messageId or clearAll=true' } },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'CHAT_DELETE_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}
