import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { ClientService } from '@/services/client.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role');

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;

    const link = await ClientService.generateTelegramLink(id, actor);

    return NextResponse.json({
      success: true,
      data: {
        link,
      },
    });
  } catch (error: any) {
    console.error('Failed to generate connection token:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONNECTION_LINK_FAILED',
          message: error.message || 'Could not generate Telegram link',
        },
      },
      { status: 500 }
    );
  }
}
