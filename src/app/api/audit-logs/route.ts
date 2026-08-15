import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import AuditLog from '@/models/AuditLog';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(100); // Retrieve recent 100 entries

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
