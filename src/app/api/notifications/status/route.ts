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

export async function GET(req: NextRequest) {
  try {
    const adminId = await getAdminUser(req);
    if (!adminId) {
      return NextResponse.json({ success: true, subscribed: false });
    }

    const subscribed = await PushNotificationService.hasSubscription(adminId);
    return NextResponse.json({ success: true, subscribed });
  } catch {
    return NextResponse.json({ success: true, subscribed: false });
  }
}
