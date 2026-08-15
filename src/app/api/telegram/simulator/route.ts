import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';

export async function POST(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const update = await req.json();

    // Log the event payload to global state so it displays in settings log
    global.lastTelegramWebhookEvent = {
      timestamp: new Date(),
      payload: update,
    };

    // Process the update directly
    await TelegramService.handleWebhookUpdate(update);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook simulator handler error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
