import { NextRequest, NextResponse } from 'next/server';
import { HostingService } from '@/services/hosting.service';

export async function POST(req: NextRequest) {
  try {
    const result = await HostingService.checkAndDispatchExpiryNotifications();
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Failed to run hosting expiry check:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
