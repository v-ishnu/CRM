import Project, { IProject } from '@/models/Project';
import Client from '@/models/Client';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

export class ProjectService {
  /**
   * Helper to generate next sequential project code (e.g. PR-0001)
   */
  static async generateNextProjectCode(): Promise<string> {
    await dbConnect();
    const lastProject = await Project.findOne({ projectCode: /^PR-\d+$/ }).sort({ projectCode: -1 });
    let nextSeq = 1;
    if (lastProject) {
      const match = lastProject.projectCode.match(/^PR-(\d+)$/);
      if (match) {
        nextSeq = parseInt(match[1], 10) + 1;
      }
    }
    
    // Ensure code is genuinely unique
    let candidate = `PR-${String(nextSeq).padStart(4, '0')}`;
    while (await Project.exists({ projectCode: candidate })) {
      nextSeq++;
      candidate = `PR-${String(nextSeq).padStart(4, '0')}`;
    }
    return candidate;
  }

  /**
   * Create a new project
   */
  static async createProject(projectData: Partial<IProject>, actor: string): Promise<IProject> {
    await dbConnect();

    // Verify client exists
    const client = await Client.findById(projectData.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    const isAutoCode = !projectData.projectCode;
    let attempts = 0;
    let savedProject: any = null;

    while (attempts < 5) {
      try {
        let code = projectData.projectCode?.toUpperCase().trim();
        if (!code) {
          code = await this.generateNextProjectCode();
        } else if (attempts === 0) {
          const existingProject = await Project.findOne({ projectCode: code });
          if (existingProject) {
            throw new Error(`Project with code "${code}" already exists`);
          }
        }

        const project = new Project({
          ...projectData,
          projectCode: code,
          status: projectData.status || 'PLANNED',
        });

        savedProject = await project.save();
        break;
      } catch (err: any) {
        if (isAutoCode && err.code === 11000 && attempts < 4) {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 50));
          continue;
        }
        throw err;
      }
    }

    if (!savedProject) {
      throw new Error('Failed to create project due to concurrency conflict after 5 attempts');
    }

    await AuditService.logAction(actor, 'PROJECT_CREATED', 'Project', savedProject._id, {
      name: savedProject.name,
      code: savedProject.projectCode,
      clientId: savedProject.clientId,
    });

    return savedProject;
  }

  /**
   * Delete a project and its associated payments, invoices, and requests without deleting the client
   */
  static async deleteProject(projectId: string, actor: string): Promise<{ success: boolean; projectName: string }> {
    await dbConnect();

    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const Invoice = (await import('@/models/Invoice')).default;
    const Payment = (await import('@/models/Payment')).default;
    const DataRequest = (await import('@/models/DataRequest')).default;
    const Credential = (await import('@/models/Credential')).default;
    const RequestResponse = (await import('@/models/RequestResponse')).default;
    const AuditLog = (await import('@/models/AuditLog')).default;
    const { StorageService } = await import('./storage.service');

    // 1. Delete invoice PDF files from storage
    const invoices = await Invoice.find({ projectId });
    for (const inv of invoices) {
      if (inv.pdfStoragePath) {
        try {
          await StorageService.deleteInvoicePDF(inv.pdfStoragePath);
        } catch (storageErr) {
          console.error(`Failed to delete invoice PDF for ${inv.invoiceNumber}:`, storageErr);
        }
      }
    }

    // 2. Delete database records
    await Invoice.deleteMany({ projectId });
    await Payment.deleteMany({ projectId });
    await DataRequest.deleteMany({ projectId });
    await Credential.deleteMany({ projectId });
    await RequestResponse.deleteMany({ projectId });
    await Project.deleteOne({ _id: projectId });

    // Clean up audit logs
    await AuditLog.deleteMany({
      $or: [
        { entityType: 'Project', entityId: projectId },
        { 'metadata.projectId': projectId },
      ]
    });

    await AuditService.logAction(actor, 'PROJECT_DELETED', 'Project', projectId, {
      projectCode: project.projectCode,
      name: project.name,
      clientId: project.clientId,
    });

    return { success: true, projectName: project.name };
  }

  /**
   * Query and list projects with optional filters
   */
  static async queryProjects(params: {
    clientId?: string;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    await dbConnect();

    const { clientId, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const query: Record<string, any> = {};

    if (clientId) {
      query.clientId = clientId;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { projectCode: searchRegex },
      ];
    }

    const projects = await Project.find(query)
      .populate('clientId', 'name company clientCode')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });

    return projects;
  }

  /**
   * Update a project's status
   */
  static async updateProjectStatus(
    projectId: string,
    newStatus: IProject['status'],
    actor: string
  ): Promise<IProject> {
    await dbConnect();

    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const oldStatus = project.status;
    if (oldStatus === newStatus) {
      return project;
    }

    project.status = newStatus;
    
    if (newStatus === 'COMPLETED') {
      project.completionDate = new Date();
    } else {
      project.completionDate = undefined;
    }

    const updatedProject = await project.save();

    await AuditService.logAction(actor, 'PROJECT_STATUS_CHANGED', 'Project', updatedProject._id, {
      oldStatus,
      newStatus,
    });

    return updatedProject;
  }

  /**
   * Update a project's details independently without mutating tasks or payments
   */
  static async updateProject(
    projectId: string,
    updateData: Partial<IProject>,
    actor: string
  ): Promise<IProject> {
    await dbConnect();

    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const updatableFields = [
      'name',
      'description',
      'serviceType',
      'totalAmount',
      'currency',
      'startDate',
      'expectedCompletionDate',
      'notes',
      'scope',
      'terms',
      'status',
    ];

    const updatedFields: string[] = [];
    const oldValues: Record<string, any> = {};

    for (const field of updatableFields) {
      if ((updateData as any)[field] !== undefined) {
        oldValues[field] = (project as any)[field];
        (project as any)[field] = (updateData as any)[field];
        updatedFields.push(field);
      }
    }

    if (updateData.status === 'COMPLETED' && !project.completionDate) {
      project.completionDate = new Date();
    } else if (updateData.status && updateData.status !== 'COMPLETED') {
      project.completionDate = undefined;
    }

    const saved = await project.save();

    await AuditService.logAction(actor, 'PROJECT_UPDATED', 'Project', saved._id, {
      projectCode: saved.projectCode,
      name: saved.name,
      updatedFields,
      oldValues,
    });

    return saved;
  }
}
