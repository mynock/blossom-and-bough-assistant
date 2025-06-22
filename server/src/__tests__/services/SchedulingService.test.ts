import { SchedulingService } from '../../services/SchedulingService';
import { GoogleSheetsService } from '../../services/GoogleSheetsService';
import { GoogleCalendarService } from '../../services/GoogleCalendarService';
import { AnthropicService } from '../../services/AnthropicService';
import { TravelTimeService } from '../../services/TravelTimeService';
import { Helper, Client, CalendarEvent } from '../../types';

// Mock all dependencies
jest.mock('../../services/GoogleSheetsService');
jest.mock('../../services/GoogleCalendarService');
jest.mock('../../services/AnthropicService');
jest.mock('../../services/TravelTimeService');

describe('SchedulingService', () => {
  let schedulingService: SchedulingService;
  let mockGoogleSheetsService: jest.Mocked<GoogleSheetsService>;
  let mockGoogleCalendarService: jest.Mocked<GoogleCalendarService>;
  let mockAnthropicService: jest.Mocked<AnthropicService>;
  let mockTravelTimeService: jest.Mocked<TravelTimeService>;

  beforeEach(() => {
    mockGoogleSheetsService = new GoogleSheetsService() as jest.Mocked<GoogleSheetsService>;
    mockGoogleCalendarService = new GoogleCalendarService() as jest.Mocked<GoogleCalendarService>;
    mockAnthropicService = new AnthropicService() as jest.Mocked<AnthropicService>;
    mockTravelTimeService = new TravelTimeService() as jest.Mocked<TravelTimeService>;

    schedulingService = new SchedulingService(
      mockGoogleSheetsService,
      mockGoogleCalendarService,
      mockAnthropicService,
      mockTravelTimeService
    );

    jest.clearAllMocks();
  });

  const mockHelper: Helper = {
    id: 'helper-1',
    name: 'John Worker',
    workdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    homeAddress: '123 Helper St',
    minHours: 6,
    maxHours: 8,
    capabilityTier: 'Intermediate',
    skills: ['pruning', 'planting', 'maintenance'],
    hourlyRate: 25,
    status: 'active',
    notes: 'Reliable worker'
  };

  const mockClient: Client = {
    id: 'client-1',
    name: 'Test Client',
    address: '456 Client Ave',
    zone: 'North',
    maintenanceSchedule: {
      isMaintenance: true,
      intervalWeeks: 4,
      hoursPerVisit: 3,
      rate: 80,
      lastVisit: '2024-01-01',
      nextTarget: '2024-01-29'
    },
    preferences: {
      preferredDays: ['Monday', 'Wednesday'],
      preferredTime: 'morning',
      flexibility: 'Preferred'
    },
    priority: 'High',
    status: 'active'
  };

  const mockCalendarEvent: CalendarEvent = {
    id: 'event-1',
    title: 'Client Maintenance',
    start: '2024-01-15T09:00:00',
    end: '2024-01-15T12:00:00',
    location: '456 Client Ave',
    eventType: 'maintenance',
    linkedRecords: {
      clientId: 'client-1',
      helperId: 'helper-1'
    },
    status: {
      confirmed: true,
      clientNotified: true,
      flexibility: 'Fixed',
      level: 'C'
    }
  };

  describe('getHelpers', () => {
    it('should return all helpers', async () => {
      mockGoogleSheetsService.getHelpers.mockResolvedValue([mockHelper]);

      const result = await schedulingService.getHelpers();

      expect(result).toEqual([mockHelper]);
      expect(mockGoogleSheetsService.getHelpers).toHaveBeenCalled();
    });
  });

  describe('checkHelperAvailability', () => {
    beforeEach(() => {
      mockGoogleSheetsService.getHelpers.mockResolvedValue([mockHelper]);
      mockGoogleCalendarService.getEvents.mockResolvedValue([mockCalendarEvent]);
    });

    it('should return availability information for a helper', async () => {
      const result = await schedulingService.checkHelperAvailability(
        'helper-1',
        '2024-01-15',
        '2024-01-19',
        4
      );

      expect(result).toHaveProperty('helper');
      expect(result).toHaveProperty('availability');
      expect(result).toHaveProperty('summary');
      expect(result.helper.id).toBe('helper-1');
    });

    it('should return unavailable for non-existent helper', async () => {
      const result = await schedulingService.checkHelperAvailability(
        'non-existent',
        '2024-01-15',
        '2024-01-19'
      );

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Helper not found');
    });

    it('should calculate workday availability correctly', async () => {
      // Mock empty calendar for the period
      mockGoogleCalendarService.getEvents.mockResolvedValue([]);

      const result = await schedulingService.checkHelperAvailability(
        'helper-1',
        '2024-01-15', // Monday
        '2024-01-17', // Wednesday
        4
      );

      expect(result.availability).toHaveLength(3); // 3 days
      expect(result.availability[0].isWorkday).toBe(true); // Monday
      expect(result.availability[0].availableHours).toBe(mockHelper.maxHours);
      expect(result.availability[1].isWorkday).toBe(true); // Tuesday
      expect(result.availability[2].isWorkday).toBe(true); // Wednesday
    });

    it('should account for existing bookings', async () => {
      const result = await schedulingService.checkHelperAvailability(
        'helper-1',
        '2024-01-15',
        '2024-01-15',
        4
      );

      // Should account for the 3-hour existing booking
      const dayAvailability = result.availability.find((day: any) => day.date === '2024-01-15');
      expect(dayAvailability.bookedHours).toBe(3);
      expect(dayAvailability.availableHours).toBe(mockHelper.maxHours - 3);
    });
  });

  describe('getMaintenanceSchedule', () => {
    beforeEach(() => {
      mockGoogleSheetsService.getClients.mockResolvedValue([mockClient]);
    });

    it('should return maintenance schedule for all clients', async () => {
      const result = await schedulingService.getMaintenanceSchedule();

      expect(result).toHaveProperty('maintenanceSchedule');
      expect(result).toHaveProperty('summary');
      expect(result.maintenanceSchedule).toHaveLength(1);
      expect(result.maintenanceSchedule[0].clientId).toBe('client-1');
    });

    it('should filter by specific client', async () => {
      const result = await schedulingService.getMaintenanceSchedule('client-1');

      expect(result.maintenanceSchedule).toHaveLength(1);
      expect(result.maintenanceSchedule[0].clientId).toBe('client-1');
    });

    it('should return error for non-existent client', async () => {
      const result = await schedulingService.getMaintenanceSchedule('non-existent');

      expect(result.maintenanceSchedule).toHaveLength(0);
      expect(result.error).toContain('No client found');
    });

    it('should identify overdue maintenance', async () => {
      const overdueClient = {
        ...mockClient,
        maintenanceSchedule: {
          ...mockClient.maintenanceSchedule,
          nextTarget: '2024-01-01' // Past date
        }
      };
      mockGoogleSheetsService.getClients.mockResolvedValue([overdueClient]);

      const result = await schedulingService.getMaintenanceSchedule();

      expect(result.summary.overdueClients).toBe(1);
      expect(result.maintenanceSchedule[0].isOverdue).toBe(true);
    });
  });

  describe('findSchedulingConflicts', () => {
    beforeEach(() => {
      mockGoogleSheetsService.getHelpers.mockResolvedValue([mockHelper]);
      mockGoogleCalendarService.getEvents.mockResolvedValue([mockCalendarEvent]);
    });

    it('should detect time overlap conflicts', async () => {
      const proposedEvent = {
        helperId: 'helper-1',
        startTime: '2024-01-15T10:00:00',
        durationHours: 2,
        location: '789 New Location'
      };

      const result = await schedulingService.findSchedulingConflicts(proposedEvent);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('time_overlap');
    });

    it('should detect daily hour limit conflicts', async () => {
      // Mock a helper with low max hours
      const lowHoursHelper = { ...mockHelper, maxHours: 4 };
      mockGoogleSheetsService.getHelpers.mockResolvedValue([lowHoursHelper]);

      const proposedEvent = {
        helperId: 'helper-1',
        startTime: '2024-01-15T13:00:00', // After existing event
        durationHours: 3, // Would exceed 4 hour limit with existing 3 hours
        location: '789 New Location'
      };

      const result = await schedulingService.findSchedulingConflicts(proposedEvent);

      expect(result.hasConflicts).toBe(true);
             const hourLimitConflict = result.conflicts.find((c: any) => c.conflictType === 'daily_hour_limit');
      expect(hourLimitConflict).toBeDefined();
      expect(hourLimitConflict.helperMaxHours).toBe(4);
      expect(hourLimitConflict.totalHours).toBe(6);
    });

    it('should return no conflicts for valid scheduling', async () => {
      // Mock no existing events
      mockGoogleCalendarService.getEvents.mockResolvedValue([]);

      const proposedEvent = {
        helperId: 'helper-1',
        startTime: '2024-01-16T09:00:00', // Different day
        durationHours: 4,
        location: '789 New Location'
      };

      const result = await schedulingService.findSchedulingConflicts(proposedEvent);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('getClientInfo', () => {
    beforeEach(() => {
      const clients = [
        mockClient,
        {
          ...mockClient,
          id: 'client-2',
          name: 'Another Client',
          zone: 'South',
          maintenanceSchedule: { isMaintenance: false }
        }
      ];
      mockGoogleSheetsService.getClients.mockResolvedValue(clients);
    });

    it('should return all clients when no filters applied', async () => {
      const result = await schedulingService.getClientInfo();

      expect(result).toHaveLength(2);
    });

    it('should filter by client name', async () => {
      const result = await schedulingService.getClientInfo('Test');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Client');
    });

    it('should filter by zone', async () => {
      const result = await schedulingService.getClientInfo(undefined, undefined, 'South');

      expect(result).toHaveLength(1);
      expect(result[0].zone).toBe('South');
    });

    it('should filter by maintenance status', async () => {
      const result = await schedulingService.getClientInfo(undefined, undefined, undefined, true);

      expect(result).toHaveLength(1);
      expect(result[0].maintenanceSchedule.isMaintenance).toBe(true);
    });

    it('should apply multiple filters', async () => {
      const result = await schedulingService.getClientInfo('Client', undefined, 'North', true);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Client');
      expect(result[0].zone).toBe('North');
      expect(result[0].maintenanceSchedule.isMaintenance).toBe(true);
    });
  });

  describe('calculateTravelTime', () => {
    it('should delegate to TravelTimeService', async () => {
      const mockTravelTime = {
        duration: 15,
        distance: '5.2 miles',
        route: 'via Main St'
      };
      mockTravelTimeService.calculateTravelTime.mockResolvedValue(mockTravelTime);

      const result = await schedulingService.calculateTravelTime('123 Origin St', '456 Dest Ave');

      expect(result).toEqual(mockTravelTime);
      expect(mockTravelTimeService.calculateTravelTime).toHaveBeenCalledWith('123 Origin St', '456 Dest Ave');
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate helper workday constraints', () => {
      const validWorkdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      mockHelper.workdays.forEach(day => {
        expect(validWorkdays).toContain(day);
      });
    });

    it('should validate client priority levels', () => {
      const validPriorities = ['High', 'Medium', 'Low'];
      expect(validPriorities).toContain(mockClient.priority);
    });

    it('should validate maintenance interval logic', () => {
      if (mockClient.maintenanceSchedule.isMaintenance) {
        expect(mockClient.maintenanceSchedule.intervalWeeks).toBeGreaterThan(0);
        expect(mockClient.maintenanceSchedule.hoursPerVisit).toBeGreaterThan(0);
      }
    });

    it('should validate time calculations', () => {
      const startTime = new Date('2024-01-15T09:00:00');
      const endTime = new Date('2024-01-15T12:00:00');
      const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      expect(durationHours).toBe(3);
      expect(durationHours).toBeLessThanOrEqual(mockHelper.maxHours);
    });
  });

  describe('Edge Cases', () => {
    it('should handle helper with no workdays', async () => {
      const noWorkdaysHelper = { ...mockHelper, workdays: [] };
      mockGoogleSheetsService.getHelpers.mockResolvedValue([noWorkdaysHelper]);

      const result = await schedulingService.checkHelperAvailability(
        'helper-1',
        '2024-01-15',
        '2024-01-19'
      );

      expect(result.availability.every((day: any) => !day.isWorkday)).toBe(true);
    });

    it('should handle client with no maintenance schedule', async () => {
      const noMaintenanceClient = {
        ...mockClient,
        maintenanceSchedule: { isMaintenance: false }
      };
      mockGoogleSheetsService.getClients.mockResolvedValue([noMaintenanceClient]);

      const result = await schedulingService.getMaintenanceSchedule();

      expect(result.maintenanceSchedule).toHaveLength(0);
    });

    it('should handle empty calendar events', async () => {
      mockGoogleCalendarService.getEvents.mockResolvedValue([]);

      const result = await schedulingService.checkHelperAvailability(
        'helper-1',
        '2024-01-15',
        '2024-01-19'
      );

      expect(result.availability.every((day: any) => day.bookedHours === 0)).toBe(true);
    });

    it('should handle date boundary conditions', async () => {
      const result = await schedulingService.checkHelperAvailability(
        'helper-1',
        '2024-01-15',
        '2024-01-15' // Same start and end date
      );

      expect(result.availability).toHaveLength(1);
    });
  });
});