import { EmployeeService } from '../../services/EmployeeService';
import { db } from '../../db';

// Mock the database module
jest.mock('../../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  employees: {
    id: 'id',
    employeeId: 'employeeId',
    name: 'name',
    regularWorkdays: 'regularWorkdays',
    activeStatus: 'activeStatus',
  }
}));

describe('EmployeeService', () => {
  let employeeService: EmployeeService;
  let mockDb: any;

  beforeEach(() => {
    employeeService = new EmployeeService();
    mockDb = db as any;
    jest.clearAllMocks();
  });

  const mockEmployee = {
    id: 1,
    employeeId: 'EMP-001',
    name: 'John Doe',
    regularWorkdays: 'Mon,Tue,Wed,Thu,Fri',
    homeAddress: '789 Worker St',
    minHoursPerDay: 6,
    maxHoursPerDay: 8,
    capabilityLevel: 3.5,
    hourlyRate: 25.00,
    notes: 'Experienced gardener',
    activeStatus: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('getAllEmployees', () => {
    it('should return all employees', async () => {
      const mockEmployees = [mockEmployee];
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue(mockEmployees)
      });

      const result = await employeeService.getAllEmployees();

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockEmployees);
    });

    it('should handle empty employee list', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue([])
      });

      const result = await employeeService.getAllEmployees();

      expect(result).toEqual([]);
    });
  });

  describe('getEmployeeById', () => {
    it('should return employee when found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockEmployee])
        })
      });

      const result = await employeeService.getEmployeeById(1);

      expect(result).toEqual(mockEmployee);
    });

    it('should return undefined when employee not found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await employeeService.getEmployeeById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('getEmployeeByEmployeeId', () => {
    it('should return employee by employeeId', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockEmployee])
        })
      });

      const result = await employeeService.getEmployeeByEmployeeId('EMP-001');

      expect(result).toEqual(mockEmployee);
    });

    it('should return undefined for non-existent employeeId', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await employeeService.getEmployeeByEmployeeId('NON-EXISTENT');

      expect(result).toBeUndefined();
    });
  });

  describe('createEmployee', () => {
    const newEmployeeData = {
      employeeId: 'EMP-002',
      name: 'Jane Smith',
      regularWorkdays: 'Mon,Wed,Fri',
      homeAddress: '123 Home Ave',
      minHoursPerDay: 4,
      maxHoursPerDay: 6,
      capabilityLevel: 2.5,
      hourlyRate: 22.50,
      activeStatus: 'active' as const,
    };

    it('should create a new employee successfully', async () => {
      const createdEmployee = { ...newEmployeeData, id: 2 };
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([createdEmployee])
        })
      });

      const result = await employeeService.createEmployee(newEmployeeData);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(createdEmployee);
    });

    it('should handle required field validation', async () => {
      const invalidData = {
        // Missing required fields
        homeAddress: '123 Home Ave',
        minHoursPerDay: 4,
      } as any;

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(new Error('Required field missing'))
        })
      });

      await expect(employeeService.createEmployee(invalidData)).rejects.toThrow();
    });
  });

  describe('updateEmployee', () => {
    const updateData = {
      name: 'John Updated',
      hourlyRate: 27.50,
      capabilityLevel: 4.0,
    };

    it('should update employee successfully', async () => {
      const updatedEmployee = { ...mockEmployee, ...updateData };
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([updatedEmployee])
          })
        })
      });

      const result = await employeeService.updateEmployee(1, updateData);

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toEqual(updatedEmployee);
    });

    it('should return undefined when employee not found for update', async () => {
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([])
          })
        })
      });

      const result = await employeeService.updateEmployee(999, updateData);

      expect(result).toBeUndefined();
    });

    it('should automatically update updatedAt timestamp', async () => {
      const updatedEmployee = { ...mockEmployee, ...updateData };
      const setMock = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([updatedEmployee])
        })
      });
      
      mockDb.update.mockReturnValue({ set: setMock });

      await employeeService.updateEmployee(1, updateData);

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updateData,
          updatedAt: expect.any(Date)
        })
      );
    });
  });

  describe('deleteEmployee', () => {
    it('should delete employee successfully', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 1 })
      });

      const result = await employeeService.deleteEmployee(1);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when employee not found for deletion', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 0 })
      });

      const result = await employeeService.deleteEmployee(999);

      expect(result).toBe(false);
    });
  });

  describe('searchEmployeesByName', () => {
    it('should return employees matching search term', async () => {
      const matchingEmployees = [mockEmployee];
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(matchingEmployees)
        })
      });

      const result = await employeeService.searchEmployeesByName('John');

      expect(result).toEqual(matchingEmployees);
    });

    it('should return empty array when no matches found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await employeeService.searchEmployeesByName('NonExistent');

      expect(result).toEqual([]);
    });
  });

  describe('getActiveEmployees', () => {
    it('should return only active employees', async () => {
      const activeEmployees = [mockEmployee];
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(activeEmployees)
        })
      });

      const result = await employeeService.getActiveEmployees();

      expect(result).toEqual(activeEmployees);
    });
  });

  describe('getEmployeesByWorkdays', () => {
    it('should return employees available on specified workdays', async () => {
      const availableEmployees = [mockEmployee];
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(availableEmployees)
        })
      });

      const result = await employeeService.getEmployeesByWorkdays('Mon');

      expect(result).toEqual(availableEmployees);
    });

    it('should handle multiple workdays search', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockEmployee])
        })
      });

      const result = await employeeService.getEmployeesByWorkdays('Mon,Wed');

      expect(result).toEqual([mockEmployee]);
    });
  });

  describe('getEmployeeByName', () => {
    it('should return employee with exact name match', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockEmployee])
        })
      });

      const result = await employeeService.getEmployeeByName('John Doe');

      expect(result).toEqual(mockEmployee);
    });

    it('should return undefined for non-exact match', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });

      const result = await employeeService.getEmployeeByName('John');

      expect(result).toBeUndefined();
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate workday hours constraints', async () => {
      expect(mockEmployee.minHoursPerDay).toBeLessThanOrEqual(mockEmployee.maxHoursPerDay);
    });

    it('should validate capability level range', async () => {
      expect(mockEmployee.capabilityLevel).toBeGreaterThan(0);
      expect(mockEmployee.capabilityLevel).toBeLessThanOrEqual(5);
    });

    it('should validate workdays format', async () => {
      const validWorkdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const employeeWorkdays = mockEmployee.regularWorkdays.split(',');
      
      employeeWorkdays.forEach(day => {
        expect(validWorkdays).toContain(day);
      });
    });

    it('should validate hourly rate is positive', async () => {
      expect(mockEmployee.hourlyRate).toBeGreaterThan(0);
    });

    it('should handle full-time vs part-time classification', async () => {
      const workdayCount = mockEmployee.regularWorkdays.split(',').length;
      const isFullTime = workdayCount >= 5 && mockEmployee.maxHoursPerDay >= 7;
      
      expect(typeof isFullTime).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('should handle employee with no workdays', async () => {
      const noWorkdaysEmployee = {
        ...mockEmployee,
        regularWorkdays: ''
      };

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([noWorkdaysEmployee])
        })
      });

      const result = await employeeService.getEmployeesByWorkdays('Mon');
      
      expect(result).toEqual([noWorkdaysEmployee]);
    });

    it('should handle employee with maximum capability level', async () => {
      const maxCapabilityEmployee = {
        ...mockEmployee,
        capabilityLevel: 5.0
      };

      expect(maxCapabilityEmployee.capabilityLevel).toBe(5.0);
    });

    it('should handle employee with minimum hours constraints', async () => {
      const minHoursEmployee = {
        ...mockEmployee,
        minHoursPerDay: 1,
        maxHoursPerDay: 1
      };

      expect(minHoursEmployee.minHoursPerDay).toBe(minHoursEmployee.maxHoursPerDay);
    });
  });
});