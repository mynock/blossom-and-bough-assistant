import express from 'express';
import { EmployeeService } from '../services/EmployeeService';
import { WorkActivityService } from '../services/WorkActivityService';

const router = express.Router();
const employeeService = new EmployeeService();
const workActivityService = new WorkActivityService();

/**
 * GET /api/employees
 * Get all employees
 */
router.get('/', async (req, res) => {
  try {
    const employees = await employeeService.getAllEmployees();
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

/**
 * GET /api/employees/active
 * Get active employees only
 */
router.get('/active', async (req, res) => {
  try {
    const employees = await employeeService.getActiveEmployees();
    res.json(employees);
  } catch (error) {
    console.error('Error fetching active employees:', error);
    res.status(500).json({ error: 'Failed to fetch active employees' });
  }
});

/**
 * GET /api/employees/search
 * Search employees by name
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }

    const employees = await employeeService.searchEmployeesByName(q);
    res.json(employees);
  } catch (error) {
    console.error('Error searching employees:', error);
    res.status(500).json({ error: 'Failed to search employees' });
  }
});

/**
 * GET /api/employees/:id
 * Get a specific employee by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const employee = await employeeService.getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

/**
 * GET /api/employees/:id/work-activities
 * Get work activities and summary for a specific employee
 */
router.get('/:id/work-activities', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    // Verify employee exists
    const employee = await employeeService.getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get work activities for this employee
    const activities = await workActivityService.getWorkActivitiesByEmployeeId(id);
    
    // Calculate summary statistics
    const totalActivities = activities.length;
    const totalHours = activities.reduce((sum, activity) => {
      const employeeHours = activity.employeesList.find(emp => emp.employeeId === id)?.hours || 0;
      return sum + employeeHours;
    }, 0);
    
    const totalBillableHours = activities.reduce((sum, activity) => {
      if ((activity as any).billableHours && activity.employeesList.some(emp => emp.employeeId === id)) {
        const employeeHours = activity.employeesList.find(emp => emp.employeeId === id)?.hours || 0;
        const billableRatio = (activity as any).billableHours / (activity as any).totalHours;
        return sum + (employeeHours * billableRatio);
      }
      return sum;
    }, 0);
    
    const totalEarnings = activities.reduce((sum, activity) => {
      const employeeHours = activity.employeesList.find(emp => emp.employeeId === id)?.hours || 0;
      const hourlyRate = (activity as any).hourlyRate || employee.hourlyRate || 0;
      return sum + (employeeHours * hourlyRate);
    }, 0);

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    activities.forEach(activity => {
      statusBreakdown[(activity as any).status] = (statusBreakdown[(activity as any).status] || 0) + 1;
    });

    // Work type breakdown
    const workTypeBreakdown: Record<string, number> = {};
    activities.forEach(activity => {
      workTypeBreakdown[(activity as any).workType] = (workTypeBreakdown[(activity as any).workType] || 0) + 1;
    });

    // Find last activity date
    const lastActivityDate = activities.length > 0 ? (activities[0] as any).date : null;

    // Calculate year-to-date hours (current year)
    const currentYear = new Date().getFullYear();
    const yearToDateHours = activities
      .filter(activity => new Date((activity as any).date).getFullYear() === currentYear)
      .reduce((sum, activity) => {
        const employeeHours = activity.employeesList.find(emp => emp.employeeId === id)?.hours || 0;
        return sum + employeeHours;
      }, 0);

    // Calculate average hours per day (based on activities in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentActivities = activities.filter(activity => 
      new Date((activity as any).date) >= thirtyDaysAgo
    );
    
    const recentTotalHours = recentActivities.reduce((sum, activity) => {
      const employeeHours = activity.employeesList.find(emp => emp.employeeId === id)?.hours || 0;
      return sum + employeeHours;
    }, 0);
    
    const uniqueDays = new Set(recentActivities.map(activity => (activity as any).date)).size;
    const averageHoursPerDay = uniqueDays > 0 ? recentTotalHours / uniqueDays : 0;

    // Calculate completion rate
    const completedActivities = activities.filter(activity => 
      (activity as any).status === 'completed' || (activity as any).status === 'invoiced'
    ).length;
    const completionRate = totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;

    // Get unique clients worked with
    const clientsWorkedWith = [...new Set(
      activities
        .filter(activity => activity.clientName)
        .map(activity => activity.clientName!)
    )];

    const summary = {
      totalActivities,
      totalHours,
      totalBillableHours,
      totalEarnings,
      statusBreakdown,
      workTypeBreakdown,
      lastActivityDate,
      yearToDateHours,
      averageHoursPerDay,
      completionRate,
      clientsWorkedWith
    };

    res.json({
      activities,
      summary
    });
  } catch (error) {
    console.error('Error fetching employee work activities:', error);
    res.status(500).json({ error: 'Failed to fetch employee work activities' });
  }
});

/**
 * POST /api/employees
 * Create a new employee
 */
router.post('/', async (req, res) => {
  try {
    const employeeData = req.body;

    // Basic validation
    if (!employeeData.employeeId || !employeeData.name || !employeeData.regularWorkdays) {
      return res.status(400).json({ 
        error: 'Missing required fields: employeeId, name, regularWorkdays' 
      });
    }

    if (!employeeData.homeAddress || !employeeData.minHoursPerDay || !employeeData.maxHoursPerDay) {
      return res.status(400).json({ 
        error: 'Missing required fields: homeAddress, minHoursPerDay, maxHoursPerDay' 
      });
    }

    if (!employeeData.capabilityLevel) {
      return res.status(400).json({ 
        error: 'Missing required field: capabilityLevel' 
      });
    }

    // Note: hourlyRate is now optional for business owners and special employees

    const created = await employeeService.createEmployee(employeeData);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

/**
 * PUT /api/employees/:id
 * Update an employee
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const updated = await employeeService.updateEmployee(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

/**
 * DELETE /api/employees/:id
 * Delete an employee
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const deleted = await employeeService.deleteEmployee(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

export default router; 