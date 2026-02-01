import express from 'express';
import { EmployeeService } from '../services/EmployeeService';
import { WorkActivityService } from '../services/WorkActivityService';
import { asyncHandler } from '../middleware/asyncHandler';
import { calculateEmployeeActivitySummary, EmployeeActivityWithHours } from '../utils/activitySummary';

const router = express.Router();
const employeeService = new EmployeeService();
const workActivityService = new WorkActivityService();

/**
 * GET /api/employees
 * Get all employees
 */
router.get('/', asyncHandler(async (req, res) => {
  const employees = await employeeService.getAllEmployees();
  res.json(employees);
}));

/**
 * GET /api/employees/active
 * Get active employees only
 */
router.get('/active', asyncHandler(async (req, res) => {
  const employees = await employeeService.getActiveEmployees();
  res.json(employees);
}));

/**
 * GET /api/employees/search
 * Search employees by name
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query parameter "q" is required' });
  }

  const employees = await employeeService.searchEmployeesByName(q);
  res.json(employees);
}));

/**
 * GET /api/employees/:id
 * Get a specific employee by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid employee ID' });
  }

  const employee = await employeeService.getEmployeeById(id);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  res.json(employee);
}));

/**
 * GET /api/employees/:id/work-activities
 * Get work activities and summary for a specific employee
 */
router.get('/:id/work-activities', asyncHandler(async (req, res) => {
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

  // Cast activities to the expected type for summary calculation
  const activitiesWithHours = activities as unknown as EmployeeActivityWithHours[];
  const summary = calculateEmployeeActivitySummary(
    activitiesWithHours,
    id,
    employee.hourlyRate
  );

  res.json({
    activities,
    summary
  });
}));

/**
 * POST /api/employees
 * Create a new employee
 */
router.post('/', asyncHandler(async (req, res) => {
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
}));

/**
 * PUT /api/employees/:id
 * Update an employee
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid employee ID' });
  }

  const updated = await employeeService.updateEmployee(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  res.json(updated);
}));

/**
 * DELETE /api/employees/:id
 * Delete an employee
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid employee ID' });
  }

  const deleted = await employeeService.deleteEmployee(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  res.json({ message: 'Employee deleted successfully' });
}));

export default router; 