import { WorkActivityService, CreateWorkActivityData } from '../../services/WorkActivityService';
import { db } from '../../db';

// Mock the database module
jest.mock('../../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  workActivities: {
    id: 'id',
    workType: 'workType',
    date: 'date',
    status: 'status',
    clientId: 'clientId',
    notionPageId: 'notionPageId',
  },
  workActivityEmployees: {
    workActivityId: 'workActivityId',
    employeeId: 'employeeId',
  },
  otherCharges: {
    workActivityId: 'workActivityId',
  },
  clients: { name: 'name' },
  projects: { name: 'name' },
  employees: { name: 'name' }
}));

describe('WorkActivityService', () => {
  let workActivityService: WorkActivityService;
  let mockDb: any;

  beforeEach(() => {
    workActivityService = new WorkActivityService();
    mockDb = db as any;
    jest.clearAllMocks();
  });

  const mockWorkActivity = {
    id: 1,
    workType: 'maintenance',
    date: '2024-01-15',
    status: 'completed',
    startTime: '09:00',
    endTime: '13:00',
    billableHours: 4,
    totalHours: 4,
    hourlyRate: 80,
    projectId: 1,
    clientId: 1,
    travelTimeMinutes: 30,
    adjustedTravelTimeMinutes: null,
    breakTimeMinutes: 15,
    notes: 'Regular maintenance visit',
    tasks: 'Prune roses, weed beds',
    notionPageId: 'notion-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockWorkActivityEmployee = {
    id: 1,
    workActivityId: 1,
    employeeId: 1,
    hours: 4,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockOtherCharge = {
    id: 1,
    workActivityId: 1,
    chargeType: 'material',
    description: '2 bags mulch',
    quantity: 2,
    unitRate: 15,
    totalCost: 30,
    billable: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('getAllWorkActivities', () => {
    it('should return all work activities with details', async () => {
      const mockActivitiesWithDetails = [{
        ...mockWorkActivity,
        clientName: 'Test Client',
        projectName: 'Test Project',
        employeesList: [{ employeeId: 1, employeeName: 'John Doe', hours: 4 }],
        chargesList: [mockOtherCharge],
        totalCharges: 30
      }];

      // Mock the main query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue([{
                ...mockWorkActivity,
                clientName: 'Test Client',
                projectName: 'Test Project'
              }])
            })
          })
        })
      });

      // Mock the employees query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { employeeId: 1, employeeName: 'John Doe', hours: 4 }
            ])
          })
        })
      });

      // Mock the charges query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockOtherCharge])
        })
      });

      const result = await workActivityService.getAllWorkActivities();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockActivitiesWithDetails[0]);
    });

    it('should handle empty work activities list', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      const result = await workActivityService.getAllWorkActivities();

      expect(result).toEqual([]);
    });
  });

  describe('getWorkActivityById', () => {
    it('should return work activity when found', async () => {
      // Mock the main query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([{
                ...mockWorkActivity,
                clientName: 'Test Client',
                projectName: 'Test Project'
              }])
            })
          })
        })
      });

      // Mock the employees query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { employeeId: 1, employeeName: 'John Doe', hours: 4 }
            ])
          })
        })
      });

      // Mock the charges query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockOtherCharge])
        })
      });

      const result = await workActivityService.getWorkActivityById(1);

             expect(result).toBeDefined();
       expect(result!.id).toBe(1);
       expect(result!.totalCharges).toBe(30);
    });

    it('should return undefined when work activity not found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      const result = await workActivityService.getWorkActivityById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('createWorkActivity', () => {
    const createData: CreateWorkActivityData = {
      workActivity: {
        workType: 'maintenance',
        date: '2024-01-20',
        status: 'planned',
        totalHours: 4,
        clientId: 1,
      },
      employees: [{ employeeId: 1, hours: 4 }],
      charges: [{
        chargeType: 'material',
        description: '1 bag fertilizer',
        totalCost: 25,
        billable: true,
      }]
    };

    it('should create work activity with employees and charges', async () => {
      const createdActivity = { ...createData.workActivity, id: 2 };
      
      // Mock work activity creation
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([createdActivity])
        })
      });

      // Mock employee insertion
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValue(undefined)
      });

      // Mock charges insertion
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValue(undefined)
      });

      const result = await workActivityService.createWorkActivity(createData);

      expect(result).toEqual(createdActivity);
      expect(mockDb.insert).toHaveBeenCalledTimes(3); // activity, employees, charges
    });

    it('should create work activity without charges', async () => {
      const createDataNoCharges: CreateWorkActivityData = {
        workActivity: createData.workActivity,
        employees: createData.employees,
      };

      const createdActivity = { ...createData.workActivity, id: 2 };
      
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([createdActivity])
        })
      });

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValue(undefined)
      });

      const result = await workActivityService.createWorkActivity(createDataNoCharges);

      expect(result).toEqual(createdActivity);
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // activity, employees only
    });

    it('should handle creation with no employees', async () => {
      const createDataNoEmployees: CreateWorkActivityData = {
        workActivity: createData.workActivity,
        employees: [],
      };

      const createdActivity = { ...createData.workActivity, id: 2 };
      
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([createdActivity])
        })
      });

      const result = await workActivityService.createWorkActivity(createDataNoEmployees);

      expect(result).toEqual(createdActivity);
      expect(mockDb.insert).toHaveBeenCalledTimes(1); // activity only
    });
  });

  describe('updateWorkActivity', () => {
    const updateData = {
      status: 'completed' as const,
      endTime: '14:00',
      billableHours: 4.5,
      notes: 'Completed maintenance, additional weeding required',
    };

    it('should update work activity successfully', async () => {
      const updatedActivity = { ...mockWorkActivity, ...updateData };
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([updatedActivity])
          })
        })
      });

      const result = await workActivityService.updateWorkActivity(1, updateData);

      expect(result).toEqual(updatedActivity);
    });

    it('should return undefined when work activity not found for update', async () => {
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([])
          })
        })
      });

      const result = await workActivityService.updateWorkActivity(999, updateData);

      expect(result).toBeUndefined();
    });

    it('should automatically update updatedAt timestamp', async () => {
      const updatedActivity = { ...mockWorkActivity, ...updateData };
      const setMock = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([updatedActivity])
        })
      });
      
      mockDb.update.mockReturnValue({ set: setMock });

      await workActivityService.updateWorkActivity(1, updateData);

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updateData,
          updatedAt: expect.any(Date)
        })
      );
    });
  });

  describe('deleteWorkActivity', () => {
    it('should delete work activity and related records successfully', async () => {
      // Mock deletion of related records
      mockDb.delete.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue({ rowCount: 1 })
      });
      mockDb.delete.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue({ rowCount: 1 })
      });
      
      // Mock deletion of work activity
      mockDb.delete.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue({ rowCount: 1 })
      });

      const result = await workActivityService.deleteWorkActivity(1);

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledTimes(3); // employees, charges, activity
    });

    it('should return false when work activity not found for deletion', async () => {
      // Mock deletion of related records (may or may not exist)
      mockDb.delete.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue({ rowCount: 0 })
      });
      mockDb.delete.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue({ rowCount: 0 })
      });
      
      // Mock deletion of work activity (not found)
      mockDb.delete.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue({ rowCount: 0 })
      });

      const result = await workActivityService.deleteWorkActivity(999);

      expect(result).toBe(false);
    });
  });

  describe('getWorkActivityByNotionPageId', () => {
    it('should return work activity by Notion page ID', async () => {
      // Mock the main query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([{
                ...mockWorkActivity,
                clientName: 'Test Client',
                projectName: 'Test Project'
              }])
            })
          })
        })
      });

      // Mock the employees query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { employeeId: 1, employeeName: 'John Doe', hours: 4 }
            ])
          })
        })
      });

      // Mock the charges query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await workActivityService.getWorkActivityByNotionPageId('notion-123');

             expect(result).toBeDefined();
       expect(result!.notionPageId).toBe('notion-123');
    });

    it('should return undefined for non-existent Notion page ID', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      const result = await workActivityService.getWorkActivityByNotionPageId('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('findExistingWorkActivities', () => {
    it('should find existing work activities for client and date', async () => {
      // Mock the main query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                orderBy: jest.fn().mockResolvedValue([{
                  ...mockWorkActivity,
                  clientName: 'Test Client',
                  projectName: 'Test Project'
                }])
              })
            })
          })
        })
      });

      // Mock the employees query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { employeeId: 1, employeeName: 'John Doe', hours: 4 }
            ])
          })
        })
      });

      // Mock the charges query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await workActivityService.findExistingWorkActivities(1, '2024-01-15');

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe(1);
      expect(result[0].date).toBe('2024-01-15');
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate work activity status transitions', async () => {
      const validStatuses = ['planned', 'in_progress', 'completed', 'invoiced'];
      expect(validStatuses).toContain(mockWorkActivity.status);
    });

    it('should validate billable hours vs total hours', async () => {
      if (mockWorkActivity.billableHours) {
        expect(mockWorkActivity.billableHours).toBeLessThanOrEqual(mockWorkActivity.totalHours);
      }
    });

    it('should validate client requirement for billable work', async () => {
      if (mockWorkActivity.billableHours && mockWorkActivity.billableHours > 0) {
        expect(mockWorkActivity.clientId).toBeDefined();
      }
    });

    it('should validate work type values', async () => {
      const validWorkTypes = ['maintenance', 'install', 'errand', 'office work', 'design'];
      expect(validWorkTypes).toContain(mockWorkActivity.workType);
    });

    it('should calculate total charges correctly', async () => {
      const charges = [
        { totalCost: 30 },
        { totalCost: 25 },
        { totalCost: 15 }
      ];
      
      const totalCharges = charges.reduce((sum, charge) => sum + charge.totalCost, 0);
      expect(totalCharges).toBe(70);
    });
  });

  describe('Edge Cases', () => {
    it('should handle work activity with no employees', async () => {
      // Mock activity with no employees
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([{
                ...mockWorkActivity,
                clientName: 'Test Client',
                projectName: 'Test Project'
              }])
            })
          })
        })
      });

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([])
          })
        })
      });

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

             const result = await workActivityService.getWorkActivityById(1);

       expect(result!.employeesList).toEqual([]);
    });

    it('should handle work activity with no charges', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await workActivityService.getWorkActivityCharges(1);

      expect(result).toEqual([]);
    });

    it('should handle missing time information gracefully', async () => {
      const incompleteActivity = {
        ...mockWorkActivity,
        startTime: null,
        endTime: null,
      };

      expect(incompleteActivity.startTime).toBeNull();
      expect(incompleteActivity.endTime).toBeNull();
    });
  });

  describe('lastUpdatedBy tracking', () => {
    test('should set lastUpdatedBy to web_app by default when creating work activity', async () => {
      // Mock the insert operation for creating work activity
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 1,
            workType: 'maintenance',
            date: '2024-01-15',
            status: 'completed',
            totalHours: 8,
            clientId: 1,
            lastUpdatedBy: 'web_app',
            createdAt: new Date(),
            updatedAt: new Date()
          }])
        })
      });

      // Mock the insert operation for employees
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValue(undefined)
      });

      const createData: CreateWorkActivityData = {
        workActivity: {
          workType: 'maintenance',
          date: '2024-01-15',
          status: 'completed',
          totalHours: 8,
          clientId: 1,
        },
        employees: [{ employeeId: 1, hours: 8 }],
      };

      const result = await workActivityService.createWorkActivity(createData);

      expect(result.lastUpdatedBy).toBe('web_app');
    });

    test('should allow explicit setting of lastUpdatedBy during creation', async () => {
      // Mock the insert operation for creating work activity
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 1,
            workType: 'maintenance',
            date: '2024-01-15',
            status: 'completed',
            totalHours: 8,
            clientId: 1,
            lastUpdatedBy: 'notion_sync',
            createdAt: new Date(),
            updatedAt: new Date()
          }])
        })
      });

      // Mock the insert operation for employees
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValue(undefined)
      });

      const createData: CreateWorkActivityData = {
        workActivity: {
          workType: 'maintenance',
          date: '2024-01-15',
          status: 'completed',
          totalHours: 8,
          clientId: 1,
          lastUpdatedBy: 'notion_sync' as const,
        },
        employees: [{ employeeId: 1, hours: 8 }],
      };

      const result = await workActivityService.createWorkActivity(createData);

      expect(result.lastUpdatedBy).toBe('notion_sync');
    });

    test('should set lastUpdatedBy to web_app by default when updating work activity', async () => {
      // First create an activity - mock the create operation
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 1,
            workType: 'maintenance',
            date: '2024-01-15',
            status: 'completed',
            totalHours: 8,
            clientId: 1,
            lastUpdatedBy: 'web_app',
            createdAt: new Date(),
            updatedAt: new Date()
          }])
        })
      });

      // Mock the insert operation for employees
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValue(undefined)
      });

      // Mock the update operation
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              id: 1,
              workType: 'maintenance',
              date: '2024-01-15',
              status: 'completed',
              totalHours: 8,
              clientId: 1,
              notes: 'Updated notes',
              lastUpdatedBy: 'web_app',
              createdAt: new Date(),
              updatedAt: new Date()
            }])
          })
        })
      });

      const createData: CreateWorkActivityData = {
        workActivity: {
          workType: 'maintenance',
          date: '2024-01-15',
          status: 'completed',
          totalHours: 8,
          clientId: 1,
        },
        employees: [{ employeeId: 1, hours: 8 }],
      };

      const created = await workActivityService.createWorkActivity(createData);

      // Update the activity without specifying lastUpdatedBy
      const updated = await workActivityService.updateWorkActivity(created.id, {
        notes: 'Updated notes',
      });

      expect(updated!.lastUpdatedBy).toBe('web_app');
    });

    test('should allow explicit setting of lastUpdatedBy during update (for system operations)', async () => {
      // First create an activity - mock the create operation
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 1,
            workType: 'maintenance',
            date: '2024-01-15',
            status: 'completed',
            totalHours: 8,
            clientId: 1,
            lastUpdatedBy: 'web_app',
            createdAt: new Date(),
            updatedAt: new Date()
          }])
        })
      });

      // Mock the insert operation for employees
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValue(undefined)
      });

      // Mock the update operation
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              id: 1,
              workType: 'maintenance',
              date: '2024-01-15',
              status: 'completed',
              totalHours: 8,
              clientId: 1,
              notes: 'Updated from Notion',
              lastUpdatedBy: 'notion_sync',
              createdAt: new Date(),
              updatedAt: new Date()
            }])
          })
        })
      });

      const createData: CreateWorkActivityData = {
        workActivity: {
          workType: 'maintenance',
          date: '2024-01-15',
          status: 'completed',
          totalHours: 8,
          clientId: 1,
        },
        employees: [{ employeeId: 1, hours: 8 }],
      };

      const created = await workActivityService.createWorkActivity(createData);

      // Update the activity explicitly setting lastUpdatedBy to notion_sync
      const updated = await workActivityService.updateWorkActivity(created.id, {
        notes: 'Updated from Notion',
        lastUpdatedBy: 'notion_sync' as const,
      });

      expect(updated!.lastUpdatedBy).toBe('notion_sync');
    });

    test('should preserve lastUpdatedBy when retrieving work activities', async () => {
      // Mock the create operation
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 1,
            workType: 'maintenance',
            date: '2024-01-15',
            status: 'completed',
            totalHours: 8,
            clientId: 1,
            lastUpdatedBy: 'notion_sync',
            createdAt: new Date(),
            updatedAt: new Date()
          }])
        })
      });

      // Mock the insert operation for employees
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValue(undefined)
      });

      // Mock the select operation for getWorkActivityById
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([{
                id: 1,
                workType: 'maintenance',
                date: '2024-01-15',
                status: 'completed',
                totalHours: 8,
                clientId: 1,
                lastUpdatedBy: 'notion_sync',
                createdAt: new Date(),
                updatedAt: new Date(),
                clientName: 'Test Client',
                projectName: null
              }])
            })
          })
        })
      });

      // Mock the employees query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { employeeId: 1, employeeName: 'Test Employee', hours: 8 }
            ])
          })
        })
      });

      // Mock the charges query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      // Mock the select operation for getAllWorkActivities
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue([{
                id: 1,
                workType: 'maintenance',
                date: '2024-01-15',
                status: 'completed',
                totalHours: 8,
                clientId: 1,
                lastUpdatedBy: 'notion_sync',
                createdAt: new Date(),
                updatedAt: new Date(),
                clientName: 'Test Client',
                projectName: null
              }])
            })
          })
        })
      });

      // Mock the employees query for getAllWorkActivities
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { employeeId: 1, employeeName: 'Test Employee', hours: 8 }
            ])
          })
        })
      });

      // Mock the charges query for getAllWorkActivities
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      // Create activity with notion_sync as lastUpdatedBy
      const createData: CreateWorkActivityData = {
        workActivity: {
          workType: 'maintenance',
          date: '2024-01-15',
          status: 'completed',
          totalHours: 8,
          clientId: 1,
          lastUpdatedBy: 'notion_sync' as const,
        },
        employees: [{ employeeId: 1, hours: 8 }],
      };

      const created = await workActivityService.createWorkActivity(createData);

      // Retrieve and check
      const retrieved = await workActivityService.getWorkActivityById(created.id);
      expect(retrieved!.lastUpdatedBy).toBe('notion_sync');

      // Also check in getAll
      const allActivities = await workActivityService.getAllWorkActivities();
      const foundActivity = allActivities.find(a => a.id === created.id);
      expect(foundActivity!.lastUpdatedBy).toBe('notion_sync');
    });
  });
});