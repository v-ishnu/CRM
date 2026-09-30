import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { HostingService } from '@/services/hosting.service';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; websiteId: string }> }
) {
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
    const { id, websiteId } = await params;
    const body = await req.json();

    const hosting = await HostingService.updateWebsite(id, websiteId, body, actor);
    const updated = hosting.websites.find((w: any) => w._id.toString() === websiteId);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; websiteId: string }> }
) {
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
    const { id, websiteId } = await params;
    const { searchParams } = new URL(req.url);
    const soft = searchParams.get('soft') === 'true';

    await HostingService.deleteWebsite(id, websiteId, actor, soft);

    return NextResponse.json({
      success: true,
      message: soft ? 'Website suspended successfully' : 'Website removed successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
