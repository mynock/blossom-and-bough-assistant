import express from 'express';
import { requireAuth } from '../middleware/auth';
import { BreakTimeAllocationService } from '../services/BreakTimeAllocationService';

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

const breakTimeService = new BreakTimeAllocationService();

/**
 * Get work activities for a specific date to preview break time allocation
 */
router.get('/preview/:date', async (req, res) => {
  try {
    const { date } = req.params;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    const workActivities = await breakTimeService.getWorkActivitiesForDate(date);
    
    const totalWorkHours = workActivities.reduce((sum, activity) => {
      return sum + (activity.billableHours || activity.totalHours || 0);
    }, 0);

    const totalBreakMinutes = workActivities.reduce((sum, activity) => {
      return sum + (activity.breakTimeMinutes || 0);
    }, 0);

    res.json({
      date,
      workActivities: workActivities.map(activity => ({
        id: activity.id,
        clientName: activity.clientName,
        workType: activity.workType,
        totalHours: activity.totalHours,
        billableHours: activity.billableHours,
        breakTimeMinutes: activity.breakTimeMinutes,
        adjustedBreakTimeMinutes: activity.adjustedBreakTimeMinutes,
        employeesList: activity.employeesList
      })),
      totalWorkHours,
      totalBreakMinutes,
      summary: {
        totalActivities: workActivities.length,
        totalWorkHours,
        totalBreakMinutes,
        averageHoursPerActivity: workActivities.length > 0 ? totalWorkHours / workActivities.length : 0
      }
    });
  } catch (error) {
    console.error('Error getting work activities for break time preview:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get work activities';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Calculate break time allocation (preview without applying)
 */
router.post('/calculate', async (req, res) => {
  try {
    const { date } = req.body;

    // Validate required fields
    if (!date) {
      return res.status(400).json({ 
        error: 'date is required' 
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    const allocationResult = await breakTimeService.allocateBreakTime(date);

    res.json(allocationResult);
  } catch (error) {
    console.error('Error calculating break time allocation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate break time allocation';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Apply break time allocation to work activities
 */
router.post('/apply', async (req, res) => {
  try {
    const { date } = req.body;

    // Validate required fields
    if (!date) {
      return res.status(400).json({ 
        error: 'date is required' 
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    const result = await breakTimeService.calculateAndApplyBreakTime(date);

    res.json(result);
  } catch (error) {
    console.error('Error applying break time allocation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to apply break time allocation';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Calculate break time allocation for a date range (preview without applying)
 */
router.post('/calculate-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    // Validate required fields
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate are required' 
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    const rangeResult = await breakTimeService.allocateBreakTimeForRange(startDate, endDate);

    res.json(rangeResult);
  } catch (error) {
    console.error('Error calculating break time allocation for range:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate break time allocation for range';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Apply break time allocation to work activities for a date range
 */
router.post('/apply-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    // Validate required fields
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate are required' 
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    const result = await breakTimeService.calculateAndApplyBreakTimeForRange(startDate, endDate);

    res.json(result);
  } catch (error) {
    console.error('Error applying break time allocation for range:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to apply break time allocation for range';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;