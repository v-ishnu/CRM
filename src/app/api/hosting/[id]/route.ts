import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Hosting from '@/models/Hosting';
import { HostingService } from '@/services/hosting.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    const hosting = await Hosting.findById(id)
      .populate('clientId', 'name clientCode email company telegramConnected')
      .populate('projectId', 'name projectCode serviceType');

    if (!hosting) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hosting record not found' } },
        { status: 404 }
      );
    }

    const daysRemaining = HostingService.calculateDaysRemaining(hosting.expiryDate);

    // Omit sensitive passwords in standard GET
    return NextResponse.json({
      success: true,
      data: {
        _id: hosting._id,
        clientId: hosting.clientId,
        projectId: hosting.projectId,
        hostingProvider: hosting.hostingProvider,
        hostingType: hosting.hostingType,
        panelUrl: hosting.panelUrl,
        serverHost: hosting.serverHost,
        domain: hosting.domain,
        port: hosting.port,
        planName: hosting.planName,
        username: hosting.username,
        startDate: hosting.startDate,
        expiryDate: hosting.expiryDate,
        daysRemaining,
        autoRenewal: hosting.autoRenewal,
        status: hosting.status,
        notes: hosting.notes,
        renewalHistory: hosting.renewalHistory,
        createdAt: hosting.createdAt,
        updatedAt: hosting.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const hosting = await HostingService.updateHosting(id, body, actor);

    return NextResponse.json({
      success: true,
      data: {
        _id: hosting._id,
        domain: hosting.domain,
        hostingProvider: hosting.hostingProvider,
        expiryDate: hosting.expiryDate,
        status: hosting.status,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    await HostingService.deleteHosting(id, actor);

    return NextResponse.json({
      success: true,
      message: 'Hosting record deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
