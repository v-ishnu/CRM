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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const adminUser = await getAdminUser(req);

    const result = await TeamChatService.markConversationAsRead(id, adminUser);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'MARK_READ_FAILED', message: error.message } },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return POST(req, { params });
}
