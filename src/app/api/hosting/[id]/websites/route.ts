import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { HostingService } from '@/services/hosting.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role') || 'ADMIN';

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

    const hosting = await HostingService.addWebsite(id, body, actor);
    const addedWebsite = hosting.websites[hosting.websites.length - 1];

    return NextResponse.json(
      {
        success: true,
        data: {
          _id: addedWebsite._id,
          domain: addedWebsite.domain,
          expiryDate: addedWebsite.expiryDate,
          status: addedWebsite.status,
          notes: addedWebsite.notes,
          credentialCount: addedWebsite.credentialIds?.length || 0,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
