import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import DataRequest from '@/models/DataRequest';
import Credential from '@/models/Credential';
import { AuditService } from '@/services/audit.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userRole = req.headers.get('x-user-role');
  const userEmail = req.headers.get('x-user-email') || 'admin';

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;
    const { action } = await req.json().catch(() => ({}));

    if (action !== 'CREDENTIAL_REVEALED' && action !== 'CREDENTIAL_COPIED') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid audit action' } },
        { status: 400 }
      );
    }

    const request = await DataRequest.findById(id);
    if (!request) {
      return NextResponse.json(
        { success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found' } },
        { status: 404 }
      );
    }

    const cred = await Credential.findOne({ requestId: id });
    const entityId = cred ? cred._id.toString() : id;

    await AuditService.logAction(
      userEmail,
      action,
      'Credential',
      entityId,
      {
        requestId: request.requestId,
        clientId: request.clientId.toString(),
        title: request.title,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
