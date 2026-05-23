import { BaseCrudService } from './BaseCrudService';
import { notifications, type Notification, type NewNotification, type Employee, type Client } from '../db';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

export type NotificationSeverity = 'info' | 'warn' | 'error';

export class NotificationService extends BaseCrudService<typeof notifications, Notification, NewNotification> {
  protected table = notifications;
  protected idColumn = notifications.id;

  async listActive(options: { limit?: number; includeRead?: boolean } = {}): Promise<Notification[]> {
    const { limit = 50, includeRead = true } = options;
    const conditions = [isNull(notifications.dismissedAt)];
    if (!includeRead) conditions.push(isNull(notifications.readAt));

    return await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async listAll(limit = 100): Promise<Notification[]> {
    return await this.db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async countUnread(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(isNull(notifications.dismissedAt), isNull(notifications.readAt)));
    return result[0]?.count ?? 0;
  }

  async markRead(id: number): Promise<Notification | undefined> {
    const results = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return results[0];
  }

  async markAllRead(): Promise<number> {
    const results = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(isNull(notifications.readAt), isNull(notifications.dismissedAt)))
      .returning({ id: notifications.id });
    return results.length;
  }

  async dismiss(id: number): Promise<Notification | undefined> {
    const now = new Date();
    const results = await this.db
      .update(notifications)
      .set({ dismissedAt: now, readAt: sql`COALESCE(${notifications.readAt}, ${now})` })
      .where(eq(notifications.id, id))
      .returning();
    return results[0];
  }

  // Convenience builders — centralize copy + link construction so emission sites stay terse.

  async notifyEmployeeAutoCreated(employee: Employee, sourceUrl?: string): Promise<Notification> {
    return this.create({
      type: 'employee_auto_created',
      severity: 'warn',
      title: `Auto-created employee: ${employee.name}`,
      body: `An employee record was created automatically during a Notion sync. Please review and update their details (workdays, hours, capability, rate).`,
      link: `/employees/${employee.id}`,
      sourceUrl,
      entityType: 'employee',
      entityId: employee.id
    });
  }

  async notifyEmployeeAmbiguousMatch(
    name: string,
    candidateIds: number[],
    sourceUrl?: string
  ): Promise<Notification> {
    return this.create({
      type: 'employee_ambiguous_match',
      severity: 'warn',
      title: `Ambiguous employee name: "${name}"`,
      body: `The name "${name}" matched ${candidateIds.length} existing employees during a Notion sync, so a new employee was auto-created instead. You may want to merge or rename to resolve the ambiguity.`,
      link: '/employees',
      sourceUrl,
      entityType: 'employee',
      metadata: { name, candidateIds }
    });
  }

  async notifyClientAutoCreated(client: Client, sourceUrl?: string): Promise<Notification> {
    return this.create({
      type: 'client_auto_created',
      severity: 'warn',
      title: `Auto-created client: ${client.name}`,
      body: `A client record was created automatically during a Notion sync. Please review and update their details (address, zone, maintenance schedule).`,
      link: `/clients/${client.id}`,
      sourceUrl,
      entityType: 'client',
      entityId: client.id
    });
  }

  async notifyCronFailed(jobName: string, error: unknown): Promise<Notification> {
    const message = error instanceof Error ? error.message : String(error);
    return this.create({
      type: 'cron_failed',
      severity: 'error',
      title: `Scheduled job failed: ${jobName}`,
      body: message,
      entityType: 'cron_run',
      metadata: { jobName, error: message }
    });
  }

  async notifyHoursUnparsed(workActivityId: number, detail: string): Promise<Notification> {
    return this.create({
      type: 'hours_unparsed',
      severity: 'warn',
      title: `Hours adjustment couldn't be applied`,
      body: detail,
      link: `/work-activities/${workActivityId}`,
      entityType: 'work_activity',
      entityId: workActivityId
    });
  }
}
