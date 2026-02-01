import { Router } from 'express';
import { services } from '../services/container';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

const travelTimeService = services.travelTimeAllocationService;

/**
 * Get work activities for a specific date to preview travel time allocation
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

    const workActivities = await travelTimeService.getWorkActivitiesForDate(date);
    
    const totalWorkHours = workActivities.reduce((sum, activity) => {
      return sum + (activity.billableHours || activity.totalHours || 0);
    }, 0);

    const totalTravelMinutes = workActivities.reduce((sum, activity) => {
      return sum + (activity.travelTimeMinutes || 0);
    }, 0);

    res.json({
      date,
      workActivities: workActivities.map(activity => ({
        id: activity.id,
        clientName: activity.clientName,
        workType: activity.workType,
        totalHours: activity.totalHours,
        billableHours: activity.billableHours,
        travelTimeMinutes: activity.travelTimeMinutes,
        adjustedTravelTimeMinutes: activity.adjustedTravelTimeMinutes,
        employeesList: activity.employeesList
      })),
      totalWorkHours,
      totalTravelMinutes,
      summary: {
        totalActivities: workActivities.length,
        totalWorkHours,
        totalTravelMinutes,
        averageHoursPerActivity: workActivities.length > 0 ? totalWorkHours / workActivities.length : 0
      }
    });
  } catch (error) {
    console.error('Error getting work activities for travel time preview:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get work activities';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Calculate travel time allocation (preview without applying)
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

    const allocationResult = await travelTimeService.allocateTravelTime(date);

    res.json(allocationResult);
  } catch (error) {
    console.error('Error calculating travel time allocation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate travel time allocation';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Apply travel time allocation to work activities
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

    const result = await travelTimeService.calculateAndApplyTravelTime(date);

    res.json(result);
  } catch (error) {
    console.error('Error applying travel time allocation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to apply travel time allocation';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Calculate travel time allocation for a date range (preview without applying)
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

    const rangeResult = await travelTimeService.allocateTravelTimeForRange(startDate, endDate);

    res.json(rangeResult);
  } catch (error) {
    console.error('Error calculating travel time allocation for range:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate travel time allocation for range';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Apply travel time allocation to work activities for a date range
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

    const result = await travelTimeService.calculateAndApplyTravelTimeForRange(startDate, endDate);

    res.json(result);
  } catch (error) {
    console.error('Error applying travel time allocation for range:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to apply travel time allocation for range';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;