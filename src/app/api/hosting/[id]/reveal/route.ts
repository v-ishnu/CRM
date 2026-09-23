import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Hosting from '@/models/Hosting';
import { decrypt } from '@/lib/security/encryption';
import { AuditService } from '@/services/audit.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const userRole = req.headers.get('x-user-role');

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required to reveal hosting secrets' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;

    const hosting = await Hosting.findById(id);
    if (!hosting) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hosting record not found' } },
        { status: 404 }
      );
    }

    let password = '';
    let sshKey = '';
    let apiToken = '';

    try {
      if (hosting.password) password = decrypt(hosting.password);
      if (hosting.sshKey) sshKey = decrypt(hosting.sshKey);
      if (hosting.apiToken) apiToken = decrypt(hosting.apiToken);
    } catch (decErr: any) {
      return NextResponse.json(
        { success: false, error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt hosting secrets' } },
        { status: 500 }
      );
    }

    // Audit secret reveal (NEVER store the secrets in audit log!)
    await AuditService.logAction(actor, 'HOSTING_SECRET_VIEWED', 'Hosting', hosting._id, {
      hostingId: hosting._id.toString(),
      domain: hosting.domain,
      adminId: actor,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: hosting._id,
        domain: hosting.domain,
        username: hosting.username,
        password,
        sshKey: sshKey || undefined,
        apiToken: apiToken || undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
