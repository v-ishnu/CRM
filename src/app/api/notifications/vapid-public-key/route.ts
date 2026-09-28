import { NextResponse } from 'next/server';
import { PushNotificationService } from '@/services/push-notification.service';

export const runtime = 'nodejs';

export async function GET() {
  const vapidPublicKey = PushNotificationService.getPublicKey();
  if (!vapidPublicKey) {
    return NextResponse.json(
      { success: false, error: 'VAPID public key not configured' },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, vapidPublicKey });
}
