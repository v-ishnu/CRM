import { NextRequest, NextResponse } from 'next/server';
import { TeamBroadcastService } from '@/services/team-broadcast.service';
import { verifyJWT } from '@/lib/auth/jwt';
import User from '@/models/User';

export const runtime = 'nodejs';

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

export async function POST(req: NextRequest) {
  try {
    const adminUser = await getAdminUser(req);
    if (adminUser.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required for broadcasting' } },
        { status: 403 }
      );
    }
    const body = await req.json();

    const { message, targetMode, recipientIds, idempotencyKey } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Message content is required' } },
        { status: 400 }
      );
    }

    if (targetMode !== 'ALL_CONNECTED' && targetMode !== 'SELECTED') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'targetMode must be ALL_CONNECTED or SELECTED' },
        },
        { status: 400 }
      );
    }

    const result = await TeamBroadcastService.sendBroadcast({
      message: message.trim(),
      targetMode,
      recipientIds: Array.isArray(recipientIds) ? recipientIds : undefined,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey.trim() : undefined,
      adminUser,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.broadcast,
        duplicate: result.duplicate || false,
      },
      { status: result.duplicate ? 200 : 201 }
    );
  } catch (error: any) {
    console.error('[API /api/team-members/broadcast] Error:', error.message);
    const status = error.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BROADCAST_FAILED', message: error.message || 'Failed to process broadcast' },
      },
      { status }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await getAdminUser(req);
    if (adminUser.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const result = await TeamBroadcastService.getBroadcasts(adminUser, { page, limit });

    return NextResponse.json({
      success: true,
      data: result.broadcasts,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
