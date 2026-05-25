import React, { useState, useEffect, useMemo } from 'react';
import { CircularProgress, Alert, Typography } from '@mui/material';
import {
  Calendar,
  Plus,
  RefreshCw,
  MapPin,
  UserRound,
  ChevronRight,
} from '../icons';
import { calendarApi, CalendarEvent } from '../services/api';

type Tone = 'green' | 'terra' | 'sky' | 'honey' | 'outline' | 'bloom' | 'parchment';

interface FilterDef {
  key: string;
  label: string;
  tone: Tone | 'solid';
  match: (e: CalendarEvent) => boolean;
}

const FILTERS: FilterDef[] = [
  { key: 'all', label: 'All visits', tone: 'solid', match: () => true },
  { key: 'maintenance', label: 'Maintenance', tone: 'green', match: (e) => e.eventType === 'maintenance' },
  { key: 'installs', label: 'Installs', tone: 'terra', match: (e) => e.eventType === 'ad_hoc' },
  { key: 'design', label: 'Design visits', tone: 'sky', match: (e) => e.eventType === 'design' },
  { key: 'errands', label: 'Errands', tone: 'honey', match: (e) => e.eventType === 'errands' },
  { key: 'helper_pto', label: 'Helper PTO', tone: 'outline', match: (e) => e.eventType === 'helper_schedule' },
];

const eventToneClass = (type: CalendarEvent['eventType']): Tone => {
  switch (type) {
    case 'maintenance': return 'green';
    case 'ad_hoc': return 'terra';
    case 'design': return 'sky';
    case 'errands': return 'honey';
    case 'helper_schedule': return 'outline';
    case 'personal': return 'bloom';
    default: return 'parchment';
  }
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
  });

const fmtDayKey = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const fmtDayHeader = (key: string) => {
  const d = new Date(key);
  return {
    weekday: d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }).toUpperCase(),
    long: d.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
  };
};

const eventHours = (e: CalendarEvent): number => {
  const ms = new Date(e.end).getTime() - new Date(e.start).getTime();
  return Math.max(0, ms / 3_600_000);
};

const helperFromEvent = (e: CalendarEvent): string | undefined => {
  // Description often encodes helper as "Helper: Sarah". Fall back to undefined.
  if (!e.description) return undefined;
  const match = e.description.match(/(?:Helper|Assigned to):\s*([^\n]+)/i);
  return match?.[1]?.trim();
};

const Schedule: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const data = await calendarApi.getEvents(14);
        setEvents(data.events);
      } catch (err) {
        setError('Failed to load schedule. Make sure the backend server is running.');
        // eslint-disable-next-line no-console
        console.error('Schedule fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === activeFilter);
    if (!f) return events;
    return events.filter(f.match);
  }, [activeFilter, events]);

  const grouped = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filtered.forEach((e) => {
      const key = fmtDayKey(e.start);
      (map[key] ||= []).push(e);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    );
    return Object.entries(map).sort(
      ([a], [b]) => new Date(a).getTime() - new Date(b).getTime(),
    );
  }, [filtered]);

  if (loading) {
    return (
      <main className="gc-page" style={{ textAlign: 'center', paddingTop: 48 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          Loading schedule…
        </Typography>
      </main>
    );
  }

  if (error) {
    return (
      <main className="gc-page">
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      </main>
    );
  }

  return (
    <main className="gc-page" data-screen-label="Schedule">
      <div
        className="gc-page-header"
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
      >
        <div>
          <div className="gc-eyebrow">Operations</div>
          <h1>Schedule</h1>
          <div className="sub">Your upcoming appointments and tasks · next 14 days</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="gc-btn secondary">
            <Calendar size={15} strokeWidth={1.8} className="ic" />
            Open in Google Calendar
          </button>
          <button type="button" className="gc-btn primary">
            <Plus size={15} strokeWidth={1.8} className="ic" />
            Add visit
          </button>
        </div>
      </div>

      <div
        className="gc-card padded"
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveFilter(f.key)}
                className={`gc-chip ${active ? 'solid' : f.tone}`}
                style={{ cursor: 'pointer', border: active ? 'none' : undefined }}
              >
                {f.tone !== 'solid' && f.tone !== 'outline' && <span className="dot" />}
                {f.label}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--fg-muted)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <RefreshCw size={13} strokeWidth={1.6} /> Synced just now
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="gc-card padded" style={{ textAlign: 'center', color: 'var(--fg-muted)' }}>
          Your schedule is clear. Use the assistant to plan new visits.
        </div>
      ) : (
        grouped.map(([key, dayEvents]) => {
          const { weekday, long } = fmtDayHeader(key);
          const totalHours = dayEvents.reduce((s, e) => s + eventHours(e), 0);
          return (
            <div key={key} className="gc-card" style={{ marginBottom: 16 }}>
              <div className="gc-card-header" style={{ alignItems: 'baseline' }}>
                <div>
                  <div className="gc-eyebrow">{weekday}</div>
                  <h3 style={{ marginTop: 4 }}>{long}</h3>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--fg-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {dayEvents.length} {dayEvents.length === 1 ? 'visit' : 'visits'} · {totalHours.toFixed(1)}h
                </div>
              </div>
              <div className="gc-card-body" style={{ padding: '4px 18px' }}>
                {dayEvents.map((e) => {
                  const helper = helperFromEvent(e);
                  return (
                    <div
                      key={e.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '98px 1fr auto',
                        gap: 18,
                        padding: '14px 0',
                        borderBottom: '1px solid var(--hairline)',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--fg-muted)',
                        }}
                      >
                        {fmtTime(e.start)} <span style={{ opacity: 0.5 }}>—</span> {fmtTime(e.end)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            marginBottom: 3,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--fg)' }}>
                            {e.title}
                          </span>
                          <span className={`gc-chip ${eventToneClass(e.eventType)}`}>
                            <span className="dot" />
                            {e.eventType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: 'var(--fg-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            flexWrap: 'wrap',
                          }}
                        >
                          {e.location && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <MapPin size={13} strokeWidth={1.6} /> {e.location}
                            </span>
                          )}
                          {helper && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <UserRound size={13} strokeWidth={1.6} /> {helper}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} strokeWidth={1.8} color="var(--fg-subtle)" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </main>
  );
};

export default Schedule;
