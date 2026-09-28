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

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await TeamChatService.getConversationMessages(id, adminUser, { page, limit });
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

    const body = await req.json();
    const text = body.text || body.message;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Message text is required' } },
        { status: 400 }
      );
    }

    const result = await TeamChatService.sendMessageFromAdmin({
      teamMemberId: id,
      text: text.trim(),
      adminUser,
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
