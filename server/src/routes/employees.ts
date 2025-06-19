import express from 'express';
import { EmployeeService } from '../services/EmployeeService';

const router = express.Router();
const employeeService = new EmployeeService();

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