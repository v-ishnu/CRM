import { NextRequest, NextResponse } from 'next/server';
import { MasterDataService } from '@/services/master-data.service';
import { MasterDataType, MASTER_DATA_TYPES } from '@/models/MasterData';
import { dbConnect } from '@/lib/db/connect';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') || undefined) as MasterDataType | undefined;
    const parentId = searchParams.get('parentId') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (type && !MASTER_DATA_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: `Type must be one of: ${MASTER_DATA_TYPES.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    const data = await MasterDataService.queryItems({ type, parentId, includeInactive });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const actorRole = req.headers.get('x-user-role') || 'ADMIN';
    const actorEmail = req.headers.get('x-user-email') || 'admin';

    if (actorRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required to create master data' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const item = await MasterDataService.createItem(body, actorEmail);
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
