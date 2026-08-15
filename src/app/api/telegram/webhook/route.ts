import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';

export async function POST(req: NextRequest) {
  // Security verification
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (expectedSecret && secretHeader !== expectedSecret) {
    console.warn('Unauthorized Telegram Webhook request. Token mismatch.');
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Webhook secret mismatch' } },
      { status: 401 }
    );
  }

  try {
    const update = await req.json();
    
    // Log the webhook payload to assist diagnostics in the admin panel
    global.lastTelegramWebhookEvent = {
      timestamp: new Date(),
      payload: update,
    };

    // Run the bot update command routing in background without holding connection
    // This prevents timeout retries from Telegram if processing takes time
    TelegramService.handleWebhookUpdate(update).catch((err) => {
      console.error('Error handling Telegram webhook update:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telegram webhook handler crashed:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
