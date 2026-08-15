import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { ProjectService } from '@/services/project.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const projects = await ProjectService.queryProjects({ clientId, status, search });
    return NextResponse.json({ success: true, data: projects });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-email') || 'admin';
  try {
    await dbConnect();
    const body = await req.json();

    const project = await ProjectService.createProject(body, actor);
    return NextResponse.json({ success: true, data: project });
  } catch (error: any) {
    console.error('Project creation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROJECT_CREATION_FAILED',
          message: error.message || 'Could not create project',
        },
      },
      { status: 500 }
    );
  }
}
