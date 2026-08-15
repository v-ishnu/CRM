import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';

export async function POST(req: NextRequest) {
  const T1 = performance.now();

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

    // Run the bot update command routing and wait for it to complete
    const result = await TelegramService.handleWebhookUpdate(update, T1);

    const T5 = performance.now();
    if (result && result.timings) {
      const timings = result.timings;
      timings.T2 = timings.T3 ? timings.T3 : performance.now();
      timings.T5 = T5;

      const processing = Math.round(timings.T2 - timings.T1);
      const telegramAPI = Math.round(timings.telegramAPI);
      const totalTiming = Math.round(timings.T5 - timings.T1);

      const webhookToProcessing = Math.round(result.startTotal ? result.startTotal - timings.T1 : 0);
      const processingToTelegram = timings.T3 && result.startTotal ? Math.round(timings.T3 - result.startTotal) : 0;
      const telegramResponseToHTTP200 = timings.T4 ? Math.round(timings.T5 - timings.T4) : 0;

      console.log(`[TELEGRAM_TIMING]
command=${result.command}
processing=${processing}ms
telegramAPI=${telegramAPI}ms
total=${totalTiming}ms

webhookToProcessing=${webhookToProcessing}ms
processingToTelegram=${processingToTelegram}ms
telegramAPI=${telegramAPI}ms
telegramResponseToHTTP200=${telegramResponseToHTTP200}ms`);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Telegram webhook handler crashed:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
