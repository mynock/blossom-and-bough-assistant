import { WorkNotesParserService } from '../../services/WorkNotesParserService';
import { AnthropicService } from '../../services/AnthropicService';

// Mock the dependencies
jest.mock('../../services/AnthropicService');
jest.mock('../../services/ClientService');
jest.mock('../../services/EmployeeService');
jest.mock('../../services/WorkActivityService');

describe('WorkNotesParserService Hours Calculation', () => {
  let workNotesParserService: WorkNotesParserService;
  let mockAnthropicService: jest.Mocked<AnthropicService>;

  beforeEach(() => {
    mockAnthropicService = new AnthropicService() as jest.Mocked<AnthropicService>;
    workNotesParserService = new WorkNotesParserService(mockAnthropicService);
  });

  describe('calculateTotalHours', () => {
    it('should calculate total hours for single employee correctly', () => {
      const activity = {
        startTime: '09:00',
        endTime: '11:05',
        employees: ['Virginia'],
        date: '2025-05-16',
        clientName: 'LaLumiere',
        workType: 'Maintenance',
        tasks: [],
        notes: '',
        confidence: 1.0,
        totalHours: 0
      };

      // Use reflection to access private method
      const calculateTotalHours = (workNotesParserService as any).calculateTotalHours.bind(workNotesParserService);
      const result = calculateTotalHours(activity);

      // 2 hours 5 minutes = 2.083 hours, rounded to 2.08
      expect(result).toBe(2.08);
    });

    it('should calculate total hours for multiple employees correctly', () => {
      const activity = {
        startTime: '09:00',
        endTime: '11:05',
        employees: ['Virginia', 'Anne'],
        date: '2025-05-16',
        clientName: 'LaLumiere',
        workType: 'Maintenance',
        tasks: [],
        notes: '',
        confidence: 1.0,
        totalHours: 0
      };

      const calculateTotalHours = (workNotesParserService as any).calculateTotalHours.bind(workNotesParserService);
      const result = calculateTotalHours(activity);

      // 2 hours 5 minutes * 2 employees = 4.16 hours
      expect(result).toBe(4.17);
    });

    it('should handle overnight work correctly', () => {
      const activity = {
        startTime: '23:00',
        endTime: '01:00',
        employees: ['Virginia'],
        date: '2025-05-16',
        clientName: 'LaLumiere',
        workType: 'Maintenance',
        tasks: [],
        notes: '',
        confidence: 1.0,
        totalHours: 0
      };

      const calculateTotalHours = (workNotesParserService as any).calculateTotalHours.bind(workNotesParserService);
      const result = calculateTotalHours(activity);

      // 2 hours overnight
      expect(result).toBe(2);
    });

    it('should return null for missing time information', () => {
      const activity = {
        employees: ['Virginia'],
        date: '2025-05-16',
        clientName: 'LaLumiere',
        workType: 'Maintenance',
        tasks: [],
        notes: '',
        confidence: 1.0,
        totalHours: 0
      };

      const calculateTotalHours = (workNotesParserService as any).calculateTotalHours.bind(workNotesParserService);
      const result = calculateTotalHours(activity);

      expect(result).toBeNull();
    });
  });

  describe('calculateBillableHours', () => {
    it('should calculate billable hours correctly with no non-billable time', () => {
      const calculateBillableHours = (workNotesParserService as any).calculateBillableHours.bind(workNotesParserService);
      const result = calculateBillableHours(4.0);

      expect(result).toBe(4.0);
    });

    it('should calculate billable hours correctly with drive time', () => {
      const calculateBillableHours = (workNotesParserService as any).calculateBillableHours.bind(workNotesParserService);
      const result = calculateBillableHours(4.0, 30); // 30 minutes drive time

      expect(result).toBe(3.5); // 4.0 - 0.5 hours
    });

    it('should calculate billable hours correctly with both drive and lunch time', () => {
      const calculateBillableHours = (workNotesParserService as any).calculateBillableHours.bind(workNotesParserService);
      const result = calculateBillableHours(8.0, 30, 60); // 30 min drive, 60 min lunch

      expect(result).toBe(6.5); // 8.0 - 0.5 - 1.0 hours
    });

    it('should not return negative billable hours', () => {
      const calculateBillableHours = (workNotesParserService as any).calculateBillableHours.bind(workNotesParserService);
      const result = calculateBillableHours(1.0, 90); // 1 hour total, 90 minutes non-billable

      expect(result).toBe(0); // Should not go negative
    });
  });
}); 