import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Hosting from '@/models/Hosting';
import { HostingService } from '@/services/hosting.service';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const provider = searchParams.get('provider');
    const search = searchParams.get('search');

    const query: Record<string, any> = {};
    if (clientId) query.clientId = clientId;
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;
    if (provider) query.hostingProvider = new RegExp(provider, 'i');
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { domain: searchRegex },
        { hostingProvider: searchRegex },
        { planName: searchRegex },
        { serverHost: searchRegex },
      ];
    }

    const hostings = await Hosting.find(query)
      .populate('clientId', 'name clientCode email company telegramConnected')
      .populate('projectId', 'name projectCode')
      .sort({ expiryDate: 1 })
      .lean();

    // Map to safe response (NEVER return password, sshKey, apiToken in list)
    const safeHostings = hostings.map((h: any) => {
      const daysRemaining = HostingService.calculateDaysRemaining(h.expiryDate);
      return {
        _id: h._id,
        clientId: h.clientId,
        projectId: h.projectId,
        hostingProvider: h.hostingProvider,
        hostingType: h.hostingType,
        panelUrl: h.panelUrl,
        serverHost: h.serverHost,
        domain: h.domain,
        port: h.port,
        planName: h.planName,
        username: h.username,
        startDate: h.startDate,
        expiryDate: h.expiryDate,
        daysRemaining,
        autoRenewal: h.autoRenewal,
        status: h.status,
        notes: h.notes,
        renewalHistoryCount: h.renewalHistory?.length || 0,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      };
    });

    return NextResponse.json({ success: true, data: safeHostings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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
    const body = await req.json();

    const hosting = await HostingService.createHosting(body, actor);

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
    console.error('Failed to create hosting:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}
