import { NextRequest, NextResponse } from 'next/server';
import { MasterDataService } from '@/services/master-data.service';
import { dbConnect } from '@/lib/db/connect';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const item = await MasterDataService.getItemById(id);

    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Master data item not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const actorRole = req.headers.get('x-user-role') || 'ADMIN';
    const actorEmail = req.headers.get('x-user-email') || 'admin';

    if (actorRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required to modify master data' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const updated = await MasterDataService.updateItem(id, body, actorEmail);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const actorRole = req.headers.get('x-user-role') || 'ADMIN';
    const actorEmail = req.headers.get('x-user-email') || 'admin';

    if (actorRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required to delete master data' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const result = await MasterDataService.deleteItem(id, actorEmail);
    return NextResponse.json({ success: true, message: `Master data "${result.label}" deleted successfully` });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
