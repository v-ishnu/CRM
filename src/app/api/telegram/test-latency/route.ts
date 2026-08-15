import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

    const commands = ['/start', '/myprofile', '/myproject', '/payments', '/invoices', '/status'];
    const results: Record<string, any> = {};

    for (const cmd of commands) {
      const httpRequests: { duration: number }[] = [];
      for (let i = 0; i < 5; i++) {
        const mockUpdate = {
          update_id: 2026000 + i,
          message: {
            message_id: 9000 + i,
            from: {
              id: 8177872862,
              username: 'latency_tester',
              is_bot: false,
            },
            chat: {
              id: 8177872862,
              type: 'private',
            },
            text: cmd,
            date: Math.floor(Date.now() / 1000),
          },
        };

        const start = performance.now();
        const response = await fetch(`${origin}/api/telegram/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': webhookSecret,
          },
          body: JSON.stringify(mockUpdate),
        });
        
        await response.text();
        const duration = Math.round(performance.now() - start);
        httpRequests.push({ duration });
      }

      const durations = httpRequests.map(r => r.duration);
      results[cmd] = {
        average: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
        min: Math.min(...durations),
        max: Math.max(...durations),
      };
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('Test latency route failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
