// setup.ts automocks this service for the DB integration suites; we need the real one here.
jest.unmock('../services/GoogleCalendarService');

import { GoogleCalendarService } from '../services/GoogleCalendarService';

const rawTimedEvent = {
  id: 'evt_timed',
  summary: 'Stoller - Maintenance',
  description: 'CLIENT: Stoller (C010)\nTRAVEL BUFFER: 25',
  location: '123 SE Oak St',
  status: 'confirmed',
  start: { dateTime: '2026-10-27T09:00:00-07:00' },
  end: { dateTime: '2026-10-27T13:00:00-07:00' },
};

const rawAllDayEvent = {
  id: 'evt_allday',
  summary: 'Virginia',
  status: 'confirmed',
  start: { date: '2026-10-27' },
  end: { date: '2026-10-28' },
};

const withGoogleItems = (items: any[]) => {
  const service = new GoogleCalendarService();
  (service as any).calendar = {
    events: { list: jest.fn().mockResolvedValue({ data: { items } }) },
  };
  return service;
};

describe('GoogleCalendarService', () => {
  describe('getEvents', () => {
    it('maps raw Google events into the CalendarEvent shape consumers read', async () => {
      const service = withGoogleItems([rawTimedEvent]);

      const [event] = await service.getEvents(7);

      expect(event).toMatchObject({
        id: 'evt_timed',
        title: 'Stoller - Maintenance',
        start: '2026-10-27T09:00:00-07:00',
        end: '2026-10-27T13:00:00-07:00',
        location: '123 SE Oak St',
        eventType: 'maintenance',
        linkedRecords: { clientId: 'C010' },
        logistics: { travelTimeBuffer: 25 },
      });
    });

    it('excludes all-day events, which are helper assignments rather than visits', async () => {
      const service = withGoogleItems([rawAllDayEvent, rawTimedEvent]);

      const events = await service.getEvents(7);

      expect(events.map(e => e.id)).toEqual(['evt_timed']);
    });
  });

  describe('getAllEvents', () => {
    it('still returns raw events, including all-day ones, for helper detection in CronService', async () => {
      const service = withGoogleItems([rawAllDayEvent, rawTimedEvent]);

      const events = await service.getAllEvents(7);

      expect(events).toEqual([rawAllDayEvent, rawTimedEvent]);
    });
  });
});
