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
        { success: false, error: 'Unauthorized: Admin session required' },
        { status: 401 }
      );
    }

    const result = await PushNotificationService.sendPushToAdmin(adminId, {
      title: 'Dr. Debuggers CRM',
      body: '🔔 Test Notification: Chrome Web Push is active and working!',
      icon: '/globe.svg',
      badge: '/globe.svg',
      data: {
        url: '/dashboard/team',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Test notification triggered',
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to trigger test push' },
      { status: 500 }
    );
  }
}
