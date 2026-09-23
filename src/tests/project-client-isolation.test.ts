import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Project from '@/models/Project';
import Task from '@/models/Task';
import Client from '@/models/Client';
import { ProjectService } from '@/services/project.service';
import { AuditService } from '@/services/audit.service';

vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/audit.service', () => ({
  AuditService: {
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

describe('Project, Client, and Task Isolation Tests', () => {
  const mockClientId = new mongoose.Types.ObjectId().toString();
  const mockProjectId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update project fields without mutating client or task records', async () => {
    const originalProject = {
      _id: mockProjectId,
      clientId: mockClientId,
      projectCode: 'PR-2026-888',
      name: 'Initial Project Name',
      serviceType: 'WEB_DEVELOPMENT',
      totalAmount: 100000,
      currency: 'INR',
      status: 'NOT_STARTED',
      scope: 'Initial Scope',
      terms: 'Initial Terms',
      save: vi.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };

    vi.spyOn(Project, 'findById').mockResolvedValue(originalProject as any);

    // Spy on Task and Client model methods to ensure NO destructive or modifying calls are made
    const taskUpdateSpy = vi.spyOn(Task, 'updateMany').mockResolvedValue({} as any);
    const taskDeleteSpy = vi.spyOn(Task, 'deleteMany').mockResolvedValue({} as any);
    const clientUpdateSpy = vi.spyOn(Client, 'updateOne').mockResolvedValue({} as any);

    const updated = await ProjectService.updateProject(
      mockProjectId,
      {
        name: 'Updated Project Name',
        totalAmount: 125000,
        status: 'ACTIVE',
        scope: 'Expanded scope including payment gateway',
        terms: '30% advance, 70% milestone',
      },
      'admin_user'
    );

    // Verify project fields were updated
    expect(updated.name).toBe('Updated Project Name');
    expect(updated.totalAmount).toBe(125000);
    expect(updated.status).toBe('ACTIVE');
    expect(updated.scope).toBe('Expanded scope including payment gateway');
    expect(updated.terms).toBe('30% advance, 70% milestone');
    expect(originalProject.save).toHaveBeenCalled();

    // Verify task and client models were NOT mutated
    expect(taskUpdateSpy).not.toHaveBeenCalled();
    expect(taskDeleteSpy).not.toHaveBeenCalled();
    expect(clientUpdateSpy).not.toHaveBeenCalled();

    // Verify audit log was recorded
    expect(AuditService.logAction).toHaveBeenCalledWith(
      'admin_user',
      'PROJECT_UPDATED',
      'Project',
      mockProjectId,
      expect.objectContaining({
        updatedFields: expect.arrayContaining(['name', 'totalAmount', 'status', 'scope', 'terms']),
        oldValues: expect.objectContaining({
          name: 'Initial Project Name',
          totalAmount: 100000,
          status: 'NOT_STARTED',
        }),
      })
    );
  });

  it('should properly set completionDate when status is changed to COMPLETED and clear it otherwise', async () => {
    const project = {
      _id: mockProjectId,
      clientId: mockClientId,
      projectCode: 'PR-2026-999',
      name: 'Mobile App',
      status: 'IN_PROGRESS',
      completionDate: undefined as any,
      save: vi.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };

    vi.spyOn(Project, 'findById').mockResolvedValue(project as any);

    // Transition to COMPLETED
    await ProjectService.updateProject(mockProjectId, { status: 'COMPLETED' }, 'admin');
    expect(project.status).toBe('COMPLETED');
    expect(project.completionDate).toBeInstanceOf(Date);

    // Transition back to IN_PROGRESS (e.g. bug reopened)
    await ProjectService.updateProject(mockProjectId, { status: 'IN_PROGRESS' }, 'admin');
    expect(project.status).toBe('IN_PROGRESS');
    expect(project.completionDate).toBeUndefined();
  });

  it('should throw an error when attempting to update a nonexistent project', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(null);

    await expect(
      ProjectService.updateProject('invalid_id', { name: 'New Name' }, 'admin')
    ).rejects.toThrow('Project not found');
  });
});
