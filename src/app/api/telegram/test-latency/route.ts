import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';

    // Mock Telegram command payload
    const mockUpdate = {
      update_id: 2026001,
      message: {
        message_id: 9001,
        from: {
          id: 8177872862,
          username: 'latency_tester',
          is_bot: false,
        },
        chat: {
          id: 8177872862,
          type: 'private',
        },
        text: '/myproject',
        date: Math.floor(Date.now() / 1000),
      },
    };

    // 1. HTTP Webhook Requests Test (5 requests)
    const httpRequests: { status: number; duration: number }[] = [];
    
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const response = await fetch(`${origin}/api/telegram/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': webhookSecret,
        },
        body: JSON.stringify(mockUpdate),
      });
      const duration = Math.round(performance.now() - start);
      httpRequests.push({
        status: response.status,
        duration,
      });
    }

    const durations = httpRequests.map(r => r.duration);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const avgDuration = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);

    // 2. Synchronous Components Trace (Awaiting handleWebhookUpdate directly)
    const traceStart = performance.now();
    const trace = await TelegramService.handleWebhookUpdate(mockUpdate);
    const traceTotal = Math.round(performance.now() - traceStart);

    // 3. Telegram API getWebhookInfo
    let webhookInfo: any = null;
    if (botToken) {
      try {
        const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          if (infoData.ok && infoData.result) {
            webhookInfo = {
              pending_update_count: infoData.result.pending_update_count ?? 0,
              last_error_message: infoData.result.last_error_message ?? null,
              last_error_date: infoData.result.last_error_date ?? null,
            };
          }
        }
      } catch (err: any) {
        console.error('Failed to get webhook info:', err);
      }
    }

    return NextResponse.json({
      success: true,
      httpRequests,
      statistics: {
        min: minDuration,
        max: maxDuration,
        average: avgDuration,
      },
      trace: trace ? {
        command: trace.command,
        clientLookup: `${trace.clientLookup}ms`,
        databaseQuery: `${trace.databaseQuery}ms`,
        handler: `${trace.handler}ms`,
        telegramAPI: `${trace.telegramAPI}ms`,
        total: `${trace.total}ms`,
        diagnosedTraceTotal: `${traceTotal}ms`,
      } : null,
      webhookInfo,
    });
  } catch (error: any) {
    console.error('Test latency route failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
