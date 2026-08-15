import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Client from '@/models/Client';
import { TelegramService } from '@/services/telegram.service';

declare global {
  // eslint-disable-next-line no-var
  var lastTelegramWebhookEvent: {
    timestamp: Date;
    payload: any;
  } | undefined;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const isConfigured = TelegramService.isConfigured();
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Not configured';
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID || 'Not configured';

    // Connected clients count
    const connectedClientsCount = await Client.countDocuments({ telegramConnected: true });

    // Fetch the last webhook event logged in memory
    const lastEvent = global.lastTelegramWebhookEvent || null;

    return NextResponse.json({
      success: true,
      data: {
        isConfigured,
        botUsername,
        adminTelegramId,
        connectedClientsCount,
        lastEvent,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Determine the application base URL
    // Can prioritize body URL, then env, then request URL origin
    const origin = req.headers.get('origin') || new URL(req.url).origin;
    const appUrl = body.appUrl || process.env.NEXT_PUBLIC_APP_URL || origin;

    if (!appUrl) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_URL', message: 'Application URL is required for webhook setup' } },
        { status: 400 }
      );
    }

    const success = await TelegramService.setWebhook(appUrl);

    if (!success) {
      return NextResponse.json(
        { success: false, error: { code: 'WEBHOOK_SETUP_FAILED', message: 'Telegram setWebhook API returned false' } },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Webhook configured successfully to: ${appUrl}/api/telegram/webhook`,
    });
  } catch (error: any) {
    console.error('Webhook configuration endpoint error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
