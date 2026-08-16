import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Project from '@/models/Project';
import Client from '@/models/Client';
import { ProjectService } from '@/services/project.service';
import { NotificationService } from '@/services/notification.service';
import { PaymentService } from '@/services/payment.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    const project = await Project.findById(id).populate('clientId', 'name clientCode email company');
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    const userRole = req.headers.get('x-user-role');
    const userEmail = req.headers.get('x-user-email');
    const client = project.clientId as any;

    if (userRole === 'CLIENT' && client && client.email !== userEmail) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Financial balance calculations
    const balances = await PaymentService.calculateProjectBalances(id);

    return NextResponse.json({
      success: true,
      data: {
        project,
        financials: balances,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
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
    const body = await req.json();

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    const oldStatus = project.status;
    const newStatus = body.status;
    const notifyClient = body.notifyClient !== false; // Default to true

    // Extract other parameters to update
    const updatableFields = ['name', 'description', 'serviceType', 'totalAmount', 'currency', 'startDate', 'expectedCompletionDate', 'notes'];
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        (project as any)[field] = body[field];
      }
    }

    // Save project fields
    let updatedProject: any = await project.save();

    // Handle status change explicitly through service to log audit and optionally notify
    if (newStatus && newStatus !== oldStatus) {
      updatedProject = await ProjectService.updateProjectStatus(id, newStatus, actor);

      // If status changed and we want to notify client, send Telegram message
      if (notifyClient) {
        const client = await Client.findById(updatedProject.clientId);
        if (client && client.telegramConnected) {
          try {
            await NotificationService.sendProjectStatusNotification(
              client._id.toString(),
              updatedProject._id.toString(),
              newStatus
            );
          } catch (notifError) {
            console.error('Failed to dispatch project status notification:', notifError);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedProject,
    });
  } catch (error: any) {
    console.error('Failed to update project:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = req.headers.get('x-user-email') || 'admin';
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

    const result = await ProjectService.deleteProject(id, actor);

    return NextResponse.json({
      success: true,
      message: `Project "${result.projectName}" deleted successfully`,
    });
  } catch (error: any) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

