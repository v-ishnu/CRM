import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { AgreementService } from '@/services/agreement.service';
import Agreement from '@/models/Agreement';

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
    const { projectId, terms } = body;

    if (!projectId || !terms) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'projectId and terms are required' } },
        { status: 400 }
      );
    }

    const agreement = await AgreementService.createAgreement(projectId, terms, actor);

    return NextResponse.json({
      success: true,
      data: agreement,
    });
  } catch (error: any) {
    console.error('Failed to create agreement:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const clientId = searchParams.get('clientId');

    const query: Record<string, any> = {};
    if (projectId) query.projectId = projectId;
    if (clientId) query.clientId = clientId;

    const agreements = await Agreement.find(query)
      .populate('projectId', 'name projectCode serviceType totalAmount currency status')
      .populate('clientId', 'name clientCode email company telegramConnected')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: agreements,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
