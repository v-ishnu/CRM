import Project, { IProject } from '@/models/Project';
import Client from '@/models/Client';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

export class ProjectService {
  /**
   * Create a new project
   */
  static async createProject(projectData: Partial<IProject>, actor: string): Promise<IProject> {
    await dbConnect();

    const code = projectData.projectCode?.toUpperCase().trim();
    if (!code) {
      throw new Error('Project code is required');
    }

    const existingProject = await Project.findOne({ projectCode: code });
    if (existingProject) {
      throw new Error(`Project with code "${code}" already exists`);
    }

    // Verify client exists
    const client = await Client.findById(projectData.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    const project = new Project({
      ...projectData,
      projectCode: code,
      status: projectData.status || 'PLANNED',
    });

    const savedProject = await project.save();

    await AuditService.logAction(actor, 'PROJECT_CREATED', 'Project', savedProject._id, {
      name: savedProject.name,
      code: savedProject.projectCode,
      clientId: savedProject.clientId,
    });

    return savedProject;
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
}
