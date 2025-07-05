import { TravelTimeAllocationService } from '../../services/TravelTimeAllocationService';
import { WorkActivityService } from '../../services/WorkActivityService';

// Mock the WorkActivityService
jest.mock('../../services/WorkActivityService');

describe('TravelTimeAllocationService', () => {
  let service: TravelTimeAllocationService;
  let mockWorkActivityService: jest.Mocked<WorkActivityService>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create service instance
    service = new TravelTimeAllocationService();
    
    // Get the mocked WorkActivityService instance
    mockWorkActivityService = service['workActivityService'] as jest.Mocked<WorkActivityService>;
  });

  describe('allocateTravelTime', () => {
    const mockDate = '2025-07-05';

    it('should calculate proportional travel time allocation correctly', async () => {
      // Mock work activities data
      const mockActivities = [
        {
          id: 1,
          clientName: 'Client A',
          travelTimeMinutes: 30,
          billableHours: 2,
          totalHours: 2,
        },
        {
          id: 2,
          clientName: 'Client B',
          travelTimeMinutes: 5,
          billableHours: 5,
          totalHours: 5,
        },
        {
          id: 3,
          clientName: 'Client C',
          travelTimeMinutes: 40,
          billableHours: 1,
          totalHours: 1,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);

      const result = await service.allocateTravelTime(mockDate);

      // Verify the calculation
      const totalTravelMinutes = 30 + 5 + 40; // 75 minutes
      const totalWorkHours = 2 + 5 + 1; // 8 hours

      expect(result).toEqual({
        date: mockDate,
        totalTravelMinutes: 75,
        totalWorkHours: 8,
        allocations: [
          {
            workActivityId: 1,
            clientName: 'Client A',
            hoursWorked: 2,
            originalTravelMinutes: 30,
            allocatedTravelMinutes: Math.floor(75 * (2/8)), // 18 minutes (rounded down from 18.75)
            newBillableHours: 2 + (18/60), // 2.3 hours
            hasZeroTravel: false,
          },
          {
            workActivityId: 2,
            clientName: 'Client B',
            hoursWorked: 5,
            originalTravelMinutes: 5,
            allocatedTravelMinutes: Math.floor(75 * (5/8)), // 46 minutes (rounded down from 46.875)
            newBillableHours: 5 + (46/60), // 5.767 hours
            hasZeroTravel: false,
          },
          {
            workActivityId: 3,
            clientName: 'Client C',
            hoursWorked: 1,
            originalTravelMinutes: 40,
            allocatedTravelMinutes: Math.floor(75 * (1/8)), // 9 minutes (rounded down from 9.375)
            newBillableHours: 1 + (9/60), // 1.15 hours
            hasZeroTravel: false,
          },
        ],
        updatedActivities: 0,
        warnings: [],
      });

      // Verify WorkActivityService was called correctly
      expect(mockWorkActivityService.getAllWorkActivities).toHaveBeenCalledWith({
        startDate: mockDate,
        endDate: mockDate,
      });
    });

    it('should handle zero travel time activities with warnings', async () => {
      const mockActivities = [
        {
          id: 1,
          clientName: 'Client A',
          travelTimeMinutes: 30,
          billableHours: 2,
          totalHours: 2,
        },
        {
          id: 2,
          clientName: 'Client B',
          travelTimeMinutes: 0, // Zero travel time
          billableHours: 3,
          totalHours: 3,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);

      const result = await service.allocateTravelTime(mockDate);

      expect(result.warnings).toContain('Activity 2 (Client B) has zero travel time');
      expect(result.allocations[1].hasZeroTravel).toBe(true);
    });

    it('should use totalHours when billableHours is null', async () => {
      const mockActivities = [
        {
          id: 1,
          clientName: 'Client A',
          travelTimeMinutes: 60,
          billableHours: null,
          totalHours: 4,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);

      const result = await service.allocateTravelTime(mockDate);

      expect(result.allocations[0].hoursWorked).toBe(4);
      expect(result.totalWorkHours).toBe(4);
    });

    it('should handle fallback to "Unknown Client" when clientName is null', async () => {
      const mockActivities = [
        {
          id: 1,
          clientName: null,
          travelTimeMinutes: 30,
          billableHours: 2,
          totalHours: 2,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);

      const result = await service.allocateTravelTime(mockDate);

      expect(result.allocations[0].clientName).toBe('Unknown Client');
    });

    it('should throw error when no work activities found', async () => {
      mockWorkActivityService.getAllWorkActivities.mockResolvedValue([]);

      await expect(service.allocateTravelTime(mockDate)).rejects.toThrow(
        'No work activities found for 2025-07-05'
      );
    });

    it('should throw error when no travel time found', async () => {
      const mockActivities = [
        {
          id: 1,
          clientName: 'Client A',
          travelTimeMinutes: 0,
          billableHours: 2,
          totalHours: 2,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);

      await expect(service.allocateTravelTime(mockDate)).rejects.toThrow(
        'No travel time found in work activities for this date'
      );
    });

    it('should throw error when no work hours found', async () => {
      const mockActivities = [
        {
          id: 1,
          clientName: 'Client A',
          travelTimeMinutes: 30,
          billableHours: 0,
          totalHours: 0,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);

      await expect(service.allocateTravelTime(mockDate)).rejects.toThrow(
        'No billable or total hours found in work activities for proportional allocation'
      );
    });
  });

  describe('applyTravelTimeAllocation', () => {
    it('should update work activities with adjusted travel time', async () => {
      const mockAllocationResult = {
        date: '2025-07-05',
        totalTravelMinutes: 75,
        totalWorkHours: 8,
        allocations: [
          {
            workActivityId: 1,
            clientName: 'Client A',
            hoursWorked: 2,
            originalTravelMinutes: 30,
            allocatedTravelMinutes: 18,
            newBillableHours: 2.3,
            hasZeroTravel: false,
          },
          {
            workActivityId: 2,
            clientName: 'Client B',
            hoursWorked: 5,
            originalTravelMinutes: 5,
            allocatedTravelMinutes: 46,
            newBillableHours: 5.767,
            hasZeroTravel: false,
          },
        ],
        updatedActivities: 0,
        warnings: [],
      };

      mockWorkActivityService.updateWorkActivity.mockResolvedValue({} as any);

      const result = await service.applyTravelTimeAllocation(mockAllocationResult);

      // Verify each work activity was updated
      expect(mockWorkActivityService.updateWorkActivity).toHaveBeenCalledTimes(2);
      expect(mockWorkActivityService.updateWorkActivity).toHaveBeenCalledWith(1, {
        adjustedTravelTimeMinutes: 18,
        lastUpdatedBy: 'web_app',
      });
      expect(mockWorkActivityService.updateWorkActivity).toHaveBeenCalledWith(2, {
        adjustedTravelTimeMinutes: 46,
        lastUpdatedBy: 'web_app',
      });

      expect(result.updatedActivities).toBe(2);
    });

    it('should handle update errors gracefully', async () => {
      const mockAllocationResult = {
        date: '2025-07-05',
        totalTravelMinutes: 30,
        totalWorkHours: 2,
        allocations: [
          {
            workActivityId: 1,
            clientName: 'Client A',
            hoursWorked: 2,
            originalTravelMinutes: 30,
            allocatedTravelMinutes: 30,
            newBillableHours: 2.5,
            hasZeroTravel: false,
          },
        ],
        updatedActivities: 0,
        warnings: [],
      };

      mockWorkActivityService.updateWorkActivity.mockRejectedValue(new Error('Database error'));

      await expect(service.applyTravelTimeAllocation(mockAllocationResult)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('calculateAndApplyTravelTime', () => {
    it('should calculate and apply travel time allocation', async () => {
      const mockDate = '2025-07-05';
      const mockActivities = [
        {
          id: 1,
          clientName: 'Client A',
          travelTimeMinutes: 60,
          billableHours: 4,
          totalHours: 4,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);
      mockWorkActivityService.updateWorkActivity.mockResolvedValue({} as any);

      const result = await service.calculateAndApplyTravelTime(mockDate);

      expect(mockWorkActivityService.getAllWorkActivities).toHaveBeenCalled();
      expect(mockWorkActivityService.updateWorkActivity).toHaveBeenCalledWith(1, {
        adjustedTravelTimeMinutes: 60,
        lastUpdatedBy: 'web_app',
      });
      expect(result.updatedActivities).toBe(1);
    });
  });

  describe('getWorkActivitiesForDate', () => {
    it('should get work activities for a specific date', async () => {
      const mockDate = '2025-07-05';
      const mockActivities = [{ id: 1, clientName: 'Client A' }];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);

      const result = await service.getWorkActivitiesForDate(mockDate);

      expect(mockWorkActivityService.getAllWorkActivities).toHaveBeenCalledWith({
        startDate: mockDate,
        endDate: mockDate,
      });
      expect(result).toBe(mockActivities);
    });
  });

  describe('Rounding behavior', () => {
    it('should round down travel time allocation as specified', async () => {
      const mockActivities = [
        {
          id: 1,
          clientName: 'Client A',
          travelTimeMinutes: 100,
          billableHours: 3,
          totalHours: 3,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);

      const result = await service.allocateTravelTime('2025-07-05');

      // 100 minutes * (3/3) = 100 minutes exactly (no rounding needed)
      expect(result.allocations[0].allocatedTravelMinutes).toBe(100);

      // Test with a case that actually needs rounding
      const mockActivitiesWithRounding = [
        {
          id: 1,
          clientName: 'Client A',
          travelTimeMinutes: 10,
          billableHours: 1,
          totalHours: 1,
        },
        {
          id: 2,
          clientName: 'Client B',
          travelTimeMinutes: 20,
          billableHours: 2,
          totalHours: 2,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivitiesWithRounding as any);

      const resultWithRounding = await service.allocateTravelTime('2025-07-05');

      // Total travel: 30 minutes, Total hours: 3
      // Client A: 30 * (1/3) = 10 minutes (exact)
      // Client B: 30 * (2/3) = 20 minutes (exact)
      expect(resultWithRounding.allocations[0].allocatedTravelMinutes).toBe(10);
      expect(resultWithRounding.allocations[1].allocatedTravelMinutes).toBe(20);
    });

    it('should demonstrate floor rounding with fractional results', async () => {
      const mockActivities = [
        {
          id: 1,
          clientName: 'Client A',
          travelTimeMinutes: 100,
          billableHours: 3,
          totalHours: 3,
        },
        {
          id: 2,
          clientName: 'Client B',
          travelTimeMinutes: 0,
          billableHours: 4,
          totalHours: 4,
        },
      ];

      mockWorkActivityService.getAllWorkActivities.mockResolvedValue(mockActivities as any);

      const result = await service.allocateTravelTime('2025-07-05');

      // Total travel: 100 minutes, Total hours: 7
      // Client A: 100 * (3/7) = 42.857... → 42 minutes (floor)
      // Client B: 100 * (4/7) = 57.142... → 57 minutes (floor)
      expect(result.allocations[0].allocatedTravelMinutes).toBe(42);
      expect(result.allocations[1].allocatedTravelMinutes).toBe(57);
    });
  });
});