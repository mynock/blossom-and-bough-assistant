import express from 'express';
import { WorkActivityService } from '../services/WorkActivityService';

const router = express.Router();
const workActivityService = new WorkActivityService();

/**
 * GET /api/work-activities
 * Get all work activities
 */
router.get('/', async (req, res) => {
  try {
    const workActivities = await workActivityService.getAllWorkActivities();
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

    const created = await workActivityService.createWorkActivity({
      workActivity,
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

    const updated = await workActivityService.updateWorkActivity(id, req.body);
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