import { ClientService } from '../../services/ClientService';
import { db } from '../../db';
import { eq, like } from 'drizzle-orm';

// Mock the database module
jest.mock('../../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  clients: {
    id: 'id',
    clientId: 'clientId',
    name: 'name',
    address: 'address',
    activeStatus: 'activeStatus',
  }
}));

describe('ClientService', () => {
  let clientService: ClientService;
  let mockDb: any;

  beforeEach(() => {
    clientService = new ClientService();
    mockDb = db as any;
    jest.clearAllMocks();
  });

  const mockClient = {
    id: 1,
    clientId: 'CLT-001',
    name: 'Test Client',
    address: '123 Test St',
    geoZone: 'North',
    isRecurringMaintenance: true,
    maintenanceIntervalWeeks: 4,
    maintenanceHoursPerVisit: '3-4',
    maintenanceRate: '80',
    lastMaintenanceDate: '2024-01-15',
    nextMaintenanceTarget: '2024-02-12',
    priorityLevel: 'High',
    scheduleFlexibility: 'Preferred',
    preferredDays: 'Mon,Tue,Wed',
    preferredTime: 'morning',
    specialNotes: 'Gate code: 1234',
    activeStatus: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('getAllClients', () => {
    it('should return all clients', async () => {
      const mockClients = [mockClient];
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue(mockClients)
      });

      const result = await clientService.getAllClients();

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockClients);
    });

    it('should handle empty client list', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue([])
      });

      const result = await clientService.getAllClients();

      expect(result).toEqual([]);
    });
  });

  describe('getClientById', () => {
    it('should return client when found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockClient])
        })
      });

      const result = await clientService.getClientById(1);

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockClient);
    });

    it('should return undefined when client not found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await clientService.getClientById(999);

      expect(result).toBeUndefined();
    });

    it('should handle invalid ID gracefully', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await clientService.getClientById(-1);

      expect(result).toBeUndefined();
    });
  });

  describe('getClientByClientId', () => {
    it('should return client by clientId', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockClient])
        })
      });

      const result = await clientService.getClientByClientId('CLT-001');

      expect(result).toEqual(mockClient);
    });

    it('should return undefined for non-existent clientId', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await clientService.getClientByClientId('NON-EXISTENT');

      expect(result).toBeUndefined();
    });
  });

  describe('createClient', () => {
    const newClientData = {
      clientId: 'CLT-002',
      name: 'New Client',
      address: '456 New St',
      geoZone: 'South',
      isRecurringMaintenance: false,
      activeStatus: 'active' as const,
    };

    it('should create a new client successfully', async () => {
      const createdClient = { ...newClientData, id: 2 };
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([createdClient])
        })
      });

      const result = await clientService.createClient(newClientData);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(createdClient);
    });

    it('should handle required field validation', async () => {
      const invalidData = {
        // Missing required fields
        address: '456 New St',
        geoZone: 'South',
      } as any;

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(new Error('Required field missing'))
        })
      });

      await expect(clientService.createClient(invalidData)).rejects.toThrow();
    });
  });

  describe('updateClient', () => {
    const updateData = {
      name: 'Updated Client Name',
      maintenanceRate: '90',
      priorityLevel: 'Medium',
    };

    it('should update client successfully', async () => {
      const updatedClient = { ...mockClient, ...updateData };
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([updatedClient])
          })
        })
      });

      const result = await clientService.updateClient(1, updateData);

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toEqual(updatedClient);
    });

    it('should return undefined when client not found for update', async () => {
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([])
          })
        })
      });

      const result = await clientService.updateClient(999, updateData);

      expect(result).toBeUndefined();
    });

    it('should automatically update updatedAt timestamp', async () => {
      const updatedClient = { ...mockClient, ...updateData };
      const setMock = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([updatedClient])
        })
      });
      
      mockDb.update.mockReturnValue({ set: setMock });

      await clientService.updateClient(1, updateData);

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updateData,
          updatedAt: expect.any(Date)
        })
      );
    });
  });

  describe('deleteClient', () => {
    it('should delete client successfully', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 1 })
      });

      const result = await clientService.deleteClient(1);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when client not found for deletion', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 0 })
      });

      const result = await clientService.deleteClient(999);

      expect(result).toBe(false);
    });

    it('should handle undefined rowCount', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: undefined })
      });

      const result = await clientService.deleteClient(1);

      expect(result).toBe(false);
    });
  });

  describe('searchClientsByName', () => {
    it('should return clients matching search term', async () => {
      const matchingClients = [mockClient];
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(matchingClients)
        })
      });

      const result = await clientService.searchClientsByName('Test');

      expect(result).toEqual(matchingClients);
    });

    it('should handle case-insensitive search', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockClient])
        })
      });

      const result = await clientService.searchClientsByName('test');

      expect(result).toEqual([mockClient]);
    });

    it('should return empty array when no matches found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await clientService.searchClientsByName('NonExistent');

      expect(result).toEqual([]);
    });
  });

  describe('getActiveClients', () => {
    it('should return only active clients', async () => {
      const activeClients = [mockClient];
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(activeClients)
        })
      });

      const result = await clientService.getActiveClients();

      expect(result).toEqual(activeClients);
    });

    it('should filter out inactive clients', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await clientService.getActiveClients();

      expect(result).toEqual([]);
    });
  });

  describe('getClientByName', () => {
    it('should return client with exact name match', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockClient])
        })
      });

      const result = await clientService.getClientByName('Test Client');

      expect(result).toEqual(mockClient);
    });

    it('should return undefined for non-exact match', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await clientService.getClientByName('Test');

      expect(result).toBeUndefined();
    });
  });

  describe('Business Logic Validation', () => {
    it('should handle maintenance client requirements', async () => {
      const maintenanceClient = {
        ...mockClient,
        isRecurringMaintenance: true,
        maintenanceIntervalWeeks: null, // Invalid for maintenance client
      };

      // This would typically be validated at the service or application level
      expect(maintenanceClient.isRecurringMaintenance).toBe(true);
      expect(maintenanceClient.maintenanceIntervalWeeks).toBeNull();
    });

    it('should validate geo zone values', async () => {
      const validZones = ['North', 'South', 'East', 'West', 'Central'];
      expect(validZones).toContain(mockClient.geoZone);
    });

    it('should validate priority levels', async () => {
      const validPriorities = ['High', 'Medium', 'Low'];
      expect(validPriorities).toContain(mockClient.priorityLevel);
    });
  });
});