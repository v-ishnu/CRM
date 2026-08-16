import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Credential from '@/models/Credential';
import { decrypt } from '@/lib/security/encryption';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    const credentials = await Credential.find({
      projectId: id,
      isRevoked: { $ne: true },
    }).lean();

    // Map to safe list: decrypt service type/name for admin display, never return password
    const safeCredentials = credentials.map((c: any) => {
      let serviceName = 'Credential';
      try {
        if (c.service) serviceName = decrypt(c.service);
      } catch {
        serviceName = 'Encrypted Service';
      }

      return {
        _id: c._id,
        service: serviceName,
        credentialType: c.credentialType,
        isRevoked: c.isRevoked,
        createdAt: c.createdAt,
      };
    });

    return NextResponse.json({ success: true, data: safeCredentials });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}
