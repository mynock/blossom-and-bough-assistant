import express from 'express';
import { WorkActivityService } from '../services/WorkActivityService';

const router = express.Router();
const workActivityService = new WorkActivityService();

/**
 * GET /api/work-activities
 * Get all work activities with optional filtering
 * Query parameters:
 * - startDate: YYYY-MM-DD format
 * - endDate: YYYY-MM-DD format  
 * - workType: string (maintenance, installation, etc.)
 * - status: string (planned, in_progress, completed, etc.)
 * - clientId: number
 * - employeeId: number
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, workType, status, clientId, employeeId } = req.query;
    
    const filters: any = {};
    
    // Date range filtering
    if (startDate) {
      filters.startDate = startDate as string;
    }
    if (endDate) {
      filters.endDate = endDate as string;
    }
    
    // Work type filtering
    if (workType) {
      filters.workType = workType as string;
    }
    
    // Status filtering
    if (status) {
      filters.status = status as string;
    }
    
    // Client filtering
    if (clientId) {
      const clientIdNum = parseInt(clientId as string);
      if (!isNaN(clientIdNum)) {
        filters.clientId = clientIdNum;
      }
    }
    
    // Employee filtering
    if (employeeId) {
      const employeeIdNum = parseInt(employeeId as string);
      if (!isNaN(employeeIdNum)) {
        filters.employeeId = employeeIdNum;
      }
    }

    const workActivities = await workActivityService.getAllWorkActivities(filters);
    res.json(workActivities);
  } catch (error) {
    console.error('Error fetching work activities:', error);
    res.status(500).json({ error: 'Failed to fetch work activities' });
  }
});

/**
 * GET /api/work-activities/:id
 * Get a specific work activity by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid work activity ID' });
    }

    const workActivity = await workActivityService.getWorkActivityById(id);
    if (!workActivity) {
      return res.status(404).json({ error: 'Work activity not found' });
    }

    res.json(workActivity);
  } catch (error) {
    console.error('Error fetching work activity:', error);
    res.status(500).json({ error: 'Failed to fetch work activity' });
  }
});

/**
 * POST /api/work-activities
 * Create a new work activity
 */
router.post('/', async (req, res) => {
  try {
    const { workActivity, employees, charges } = req.body;

    // Basic validation
    if (!workActivity || !workActivity.workType || !workActivity.date || !workActivity.totalHours) {
      return res.status(400).json({ 
        error: 'Missing required fields: workType, date, totalHours' 
      });
    }

    if (!employees || employees.length === 0) {
      return res.status(400).json({ 
        error: 'At least one employee must be assigned to the work activity' 
      });
    }

    // Ensure lastUpdatedBy is controlled by the system, not the user
    const sanitizedWorkActivity = {
      ...workActivity,
      lastUpdatedBy: 'web_app' as const // Always set to web_app for API requests
    };

    const created = await workActivityService.createWorkActivity({
      workActivity: sanitizedWorkActivity,
      employees,
      charges
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating work activity:', error);
    res.status(500).json({ error: 'Failed to create work activity' });
  }
});

/**
 * PUT /api/work-activities/:id
 * Update a work activity
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid work activity ID' });
    }

    // Ensure lastUpdatedBy is controlled by the system, not the user
    // Remove it from the request body if present and let the service set it
    const { lastUpdatedBy, ...updateData } = req.body;

    const updated = await workActivityService.updateWorkActivity(id, updateData);
    if (!updated) {
      return res.status(404).json({ error: 'Work activity not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating work activity:', error);
    res.status(500).json({ error: 'Failed to update work activity' });
  }
});

/**
 * DELETE /api/work-activities/:id
 * Delete a work activity
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid work activity ID' });
    }

    const deleted = await workActivityService.deleteWorkActivity(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Work activity not found' });
    }

    res.status(204).send(); // No content response for successful delete
  } catch (error) {
    console.error('Error deleting work activity:', error);
    res.status(500).json({ error: 'Failed to delete work activity' });
  }
});

export default router; 