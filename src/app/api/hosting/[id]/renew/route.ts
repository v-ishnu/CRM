import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { HostingService } from '@/services/hosting.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role');

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const { newExpiryDate, notes } = body;

    if (!newExpiryDate) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'newExpiryDate is required' } },
        { status: 400 }
      );
    }

    const hosting = await HostingService.renewHosting(id, new Date(newExpiryDate), actor, notes);

    return NextResponse.json({
      success: true,
      data: {
        _id: hosting._id,
        domain: hosting.domain,
        expiryDate: hosting.expiryDate,
        status: hosting.status,
        renewalHistory: hosting.renewalHistory,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
