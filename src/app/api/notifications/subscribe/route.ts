import { NextRequest, NextResponse } from 'next/server';
import { PushNotificationService } from '@/services/push-notification.service';
import { verifyJWT } from '@/lib/auth/jwt';
import User from '@/models/User';

export const runtime = 'nodejs';

async function getAdminUser(req: NextRequest) {
  let userId = req.headers.get('x-user-id');
  if (!userId) {
    const sessionCookie = req.cookies.get('session')?.value;
    if (sessionCookie) {
      const payload = await verifyJWT(sessionCookie);
      if (payload) userId = payload.id;
    }
  }
  if (!userId) {
    const defaultAdmin = await User.findOne({ role: 'ADMIN' });
    if (defaultAdmin) userId = defaultAdmin._id.toString();
  }
  return userId;
}

export async function POST(req: NextRequest) {
  try {
    const adminId = await getAdminUser(req);
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const userAgent = req.headers.get('user-agent') || undefined;

    const record = await PushNotificationService.saveSubscription(adminId, {
      endpoint: body.endpoint,
      keys: body.keys,
      userAgent,
    });

    return NextResponse.json({ success: true, data: { id: record._id } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save push subscription' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminId = await getAdminUser(req);
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    if (!body.endpoint) {
      return NextResponse.json(
        { success: false, error: 'Endpoint is required' },
        { status: 400 }
      );
    }

    const removed = await PushNotificationService.unsubscribe(adminId, body.endpoint);
    return NextResponse.json({ success: true, removed });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to unsubscribe' },
      { status: 400 }
    );
  }
}
