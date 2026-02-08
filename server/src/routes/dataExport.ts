import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { debugLog } from '../utils/logger';
import { services } from '../services/container';
import {
  workActivities,
  workActivityEmployees,
  otherCharges,
  plantList,
  clients,
  employees,
  projects,
} from '../db';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';

const router = express.Router();

/**
 * Bearer token auth middleware for server-to-server export endpoint.
 * Validates against DATA_EXPORT_SECRET env var.
 */
const requireExportToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = process.env.DATA_EXPORT_SECRET;

  if (!secret) {
    return res.status(503).json({ error: 'Data export is not configured on this server' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  if (token !== secret) {
    return res.status(403).json({ error: 'Invalid export token' });
  }

  next();
};

router.use(requireExportToken);

/**
 * GET /api/data-export/work-activities
 * Export work activities with related data for server-to-server import.
 * Query params: startDate, endDate (default: last 30 days)
 */
router.get('/work-activities', asyncHandler(async (req, res) => {
  const db = services.workActivityService.db;

  // Default date range: last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const startDate = (req.query.startDate as string) || thirtyDaysAgo.toISOString().split('T')[0];
  const endDate = (req.query.endDate as string) || now.toISOString().split('T')[0];

  debugLog.info('Data export: Fetching work activities', { startDate, endDate });

  // Fetch work activities in date range with client/project names
  const activities = await db
    .select({
      id: workActivities.id,
      workType: workActivities.workType,
      date: workActivities.date,
      status: workActivities.status,
      startTime: workActivities.startTime,
      endTime: workActivities.endTime,
      billableHours: workActivities.billableHours,
      totalHours: workActivities.totalHours,
      hourlyRate: workActivities.hourlyRate,
      clientId: workActivities.clientId,
      projectId: workActivities.projectId,
      travelTimeMinutes: workActivities.travelTimeMinutes,
      adjustedTravelTimeMinutes: workActivities.adjustedTravelTimeMinutes,
      breakTimeMinutes: workActivities.breakTimeMinutes,
      adjustedBreakTimeMinutes: workActivities.adjustedBreakTimeMinutes,
      nonBillableTimeMinutes: workActivities.nonBillableTimeMinutes,
      notes: workActivities.notes,
      tasks: workActivities.tasks,
      notionPageId: workActivities.notionPageId,
      lastUpdatedBy: workActivities.lastUpdatedBy,
      createdAt: workActivities.createdAt,
      clientName: clients.name,
      projectName: projects.name,
    })
    .from(workActivities)
    .leftJoin(clients, eq(workActivities.clientId, clients.id))
    .leftJoin(projects, eq(workActivities.projectId, projects.id))
    .where(and(
      gte(workActivities.date, startDate),
      lte(workActivities.date, endDate)
    ));

  // Collect activity IDs for batch fetching related data
  const activityIds = activities.map(a => a.id);

  // Fetch employee assignments for all activities
  let employeeAssignments: Array<{ workActivityId: number; employeeName: string; hours: number }> = [];
  if (activityIds.length > 0) {
    const rawAssignments = await db
      .select({
        workActivityId: workActivityEmployees.workActivityId,
        employeeName: employees.name,
        hours: workActivityEmployees.hours,
      })
      .from(workActivityEmployees)
      .innerJoin(employees, eq(workActivityEmployees.employeeId, employees.id))
      .where(inArray(workActivityEmployees.workActivityId, activityIds));
    employeeAssignments = rawAssignments;
  }

  // Fetch charges for all activities
  let charges: Array<any> = [];
  if (activityIds.length > 0) {
    charges = await db
      .select()
      .from(otherCharges)
      .where(inArray(otherCharges.workActivityId, activityIds));
  }

  // Fetch plants for all activities
  let plants: Array<any> = [];
  if (activityIds.length > 0) {
    plants = await db
      .select()
      .from(plantList)
      .where(inArray(plantList.workActivityId, activityIds));
  }

  // Build activity export data with resolved names
  const exportedActivities = activities.map(activity => {
    const activityEmployees = employeeAssignments
      .filter(ea => ea.workActivityId === activity.id)
      .map(ea => ({ employeeName: ea.employeeName, hours: ea.hours }));

    const activityCharges = charges
      .filter(c => c.workActivityId === activity.id)
      .map(({ id, workActivityId, createdAt, updatedAt, ...rest }) => rest);

    const activityPlants = plants
      .filter(p => p.workActivityId === activity.id)
      .map(({ id, workActivityId, createdAt, updatedAt, ...rest }) => rest);

    return {
      workType: activity.workType,
      date: activity.date,
      status: activity.status,
      startTime: activity.startTime,
      endTime: activity.endTime,
      billableHours: activity.billableHours,
      totalHours: activity.totalHours,
      hourlyRate: activity.hourlyRate,
      clientName: activity.clientName,
      projectName: activity.projectName,
      travelTimeMinutes: activity.travelTimeMinutes,
      adjustedTravelTimeMinutes: activity.adjustedTravelTimeMinutes,
      breakTimeMinutes: activity.breakTimeMinutes,
      adjustedBreakTimeMinutes: activity.adjustedBreakTimeMinutes,
      nonBillableTimeMinutes: activity.nonBillableTimeMinutes,
      notes: activity.notes,
      tasks: activity.tasks,
      notionPageId: activity.notionPageId,
      lastUpdatedBy: activity.lastUpdatedBy,
      employees: activityEmployees,
      charges: activityCharges,
      plants: activityPlants,
    };
  });

  // Collect unique client and employee names referenced
  const clientIds = [...new Set(activities.map(a => a.clientId).filter(Boolean))] as number[];
  const employeeNames = [...new Set(employeeAssignments.map(ea => ea.employeeName))];

  // Fetch full client data
  let exportedClients: Array<any> = [];
  if (clientIds.length > 0) {
    const clientRows = await db
      .select()
      .from(clients)
      .where(inArray(clients.id, clientIds));
    exportedClients = clientRows.map(({ id, createdAt, updatedAt, ...rest }) => rest);
  }

  // Fetch full employee data
  let exportedEmployees: Array<any> = [];
  if (employeeNames.length > 0) {
    const allEmployees = await db.select().from(employees);
    exportedEmployees = allEmployees
      .filter(e => employeeNames.includes(e.name))
      .map(({ id, createdAt, updatedAt, ...rest }) => rest);
  }

  debugLog.info('Data export: Complete', {
    activitiesCount: exportedActivities.length,
    clientsCount: exportedClients.length,
    employeesCount: exportedEmployees.length,
  });

  res.json({
    exportedAt: new Date().toISOString(),
    dateRange: { startDate, endDate },
    activities: exportedActivities,
    clients: exportedClients,
    employees: exportedEmployees,
  });
}));

export default router;
