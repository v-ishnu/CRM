import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import DataRequest from '@/models/DataRequest';
import Credential from '@/models/Credential';
import RequestResponse from '@/models/RequestResponse';
import { StorageService } from '@/services/storage.service';
import { AuditService } from '@/services/audit.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;

    const request = await DataRequest.findById(id).populate('clientId', 'name clientCode');
    if (!request) {
      return NextResponse.json(
        { success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found' } },
        { status: 404 }
      );
    }

    let credentialMeta = null;
    let responseMeta = null;

    if (request.type === 'CREDENTIAL') {
      const cred = await Credential.findOne({ requestId: id }).lean();
      if (cred) {
        credentialMeta = {
          hasCredentials: true,
          version: cred.version,
          createdAt: cred.createdAt,
          updatedAt: cred.updatedAt,
        };
      }
    } else {
      const resp = await RequestResponse.findOne({ requestId: id }).lean();
      if (resp) {
        const filesWithUrls = await Promise.all(
          (resp.files || []).map(async (file) => {
            let downloadUrl = '';
            try {
              downloadUrl = await StorageService.getSignedUrl(file.storagePath);
            } catch (err) {
              console.error('Failed to generate signed url for request file:', err);
            }
            return {
              ...file,
              downloadUrl,
            };
          })
        );
        responseMeta = {
          ...resp,
          files: filesWithUrls,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        request,
        credentialMeta,
        responseMeta,
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
  const userRole = req.headers.get('x-user-role');
  const actor = req.headers.get('x-user-email') || 'admin';

  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const { id } = await params;

    const request = await DataRequest.findById(id);
    if (!request) {
      return NextResponse.json(
        { success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found' } },
        { status: 404 }
      );
    }

    // Delete associated Credential records
    if (request.type === 'CREDENTIAL') {
      await Credential.deleteOne({ requestId: id });
    } else {
      // Delete associated response and files from Supabase Storage
      const response = await RequestResponse.findOne({ requestId: id });
      if (response && response.files && response.files.length > 0) {
        for (const file of response.files) {
          await StorageService.deleteInvoicePDF(file.storagePath);
        }
      }
      await RequestResponse.deleteOne({ requestId: id });
    }

    await DataRequest.deleteOne({ _id: id });

    // Create audit log
    const auditAction = request.type === 'CREDENTIAL' ? 'CREDENTIAL_DELETED' : 'DATA_REQUEST_DELETED';
    await AuditService.logAction(
      actor,
      auditAction,
      'DataRequest',
      id,
      {
        requestId: request.requestId,
        clientId: request.clientId.toString(),
        title: request.title,
      }
    );

    return NextResponse.json({ success: true, message: 'Request permanently deleted.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
