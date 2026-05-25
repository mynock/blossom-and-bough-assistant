import React, { useState, useEffect, useMemo } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ClipboardCheck,
  Receipt,
  ChevronRight,
  ArrowRight,
  Leaf,
  Building2,
  Clock,
  Banknote,
  MapPin,
} from '../icons';
import { API_ENDPOINTS } from '../config/api';
import { formatDateBriefPacific } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';

interface WorkActivity {
  id: number;
  date: string;
  workType: string;
  clientName: string;
  clientId?: number;
  totalHours: number;
  billableHours?: number;
  totalCharges?: number;
  status: string;
}

interface DashboardState {
  totalActivities: number;
  thisWeekActivities: number;
  totalHours: number;
  billableHours: number;
  needsReviewCount: number;
  readyToInvoiceAmount: number;
  readyToInvoiceClientCount: number;
  readyToInvoiceVisitCount: number;
  recentActivities: WorkActivity[];
  upcomingActivities: WorkActivity[];
}

interface QuickStats {
  activeClients: number;
  hoursThisWeek: number;
  billableHoursThisWeek: number;
  visitsThisWeek: number;
}

type FilterKey = 'all' | 'needs_review' | 'completed' | 'planned';

const FILTERS: { key: FilterKey; label: string; tone: 'solid' | 'honey' | 'green' | 'sky' }[] = [
  { key: 'all', label: 'All', tone: 'solid' },
  { key: 'needs_review', label: 'Needs review', tone: 'honey' },
  { key: 'completed', label: 'Completed', tone: 'green' },
  { key: 'planned', label: 'Planned', tone: 'sky' },
];

const statusTone = (status: string): 'green' | 'terra' | 'honey' | 'sky' | 'solid' | 'outline' => {
  switch (status) {
    case 'completed': return 'green';
    case 'in_progress': return 'terra';
    case 'needs_review': return 'honey';
    case 'planned': return 'sky';
    case 'invoiced': return 'solid';
    default: return 'outline';
  }
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabels = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HeroCard: React.FC<{
  tone: 'moss' | 'terra';
  eye: string;
  title: string;
  body: string;
  cta: string;
  badge?: number | string;
  Icon?: LucideIcon;
  onClick: () => void;
}> = ({ tone, eye, title, body, cta, badge, Icon, onClick }) => {
  const bg = tone === 'terra'
    ? 'linear-gradient(135deg, #C2693E 0%, #9C4F2E 100%)'
    : 'linear-gradient(135deg, #3D6A42 0%, #2F5233 100%)';
  return (
    <div
      style={{
        borderRadius: 12,
        padding: 18,
        color: 'var(--linen)',
        background: bg,
        boxShadow: '0 6px 12px rgba(58,46,31,0.08), 0 18px 32px rgba(58,46,31,0.10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 156,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(251,250,244,0.7)',
        }}>
          {eye}
        </div>
        {badge != null && (
          <span style={{
            height: 18,
            padding: '0 7px',
            borderRadius: 999,
            background: 'rgba(251,250,244,0.22)',
            fontSize: 10.5,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 22,
        lineHeight: 1.2,
        fontWeight: 600,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 13,
        lineHeight: 1.5,
        color: 'rgba(251,250,244,0.85)',
        flex: 1,
      }}>
        {body}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="gc-btn"
        style={{
          background: 'rgba(251,250,244,0.18)',
          color: 'var(--linen)',
          border: '1px solid rgba(251,250,244,0.28)',
          alignSelf: 'flex-start',
        }}
      >
        {Icon && <Icon size={14} strokeWidth={1.8} />}
        {cta}
      </button>
    </div>
  );
};

const KpiTile: React.FC<{
  label: string;
  value: React.ReactNode;
  trend?: { dir: 'up' | 'down' | 'flat'; text: string };
  sub?: string;
}> = ({ label, value, trend, sub }) => (
  <div className="gc-card padded" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500 }}>{label}</div>
    <div className="gc-num-display" style={{ fontSize: 26 }}>{value}</div>
    {trend && (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10.5,
        fontFamily: 'var(--font-mono)',
        color: trend.dir === 'up' ? 'var(--moss-600)' : trend.dir === 'down' ? 'var(--bloom-600)' : 'var(--fg-muted)',
      }}>
        <span>{trend.dir === 'up' ? '▲' : trend.dir === 'down' ? '▼' : '·'}</span>
        <span>{trend.text}</span>
      </div>
    )}
    {sub && <div className="gc-muted" style={{ fontSize: 11 }}>{sub}</div>}
  </div>
);

const StatRow: React.FC<{
  Icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}> = ({ Icon, label, value }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--hairline)',
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: 'var(--fg-muted)',
      fontSize: 13.5,
    }}>
      <Icon size={16} strokeWidth={1.6} />
      {label}
    </div>
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--fg)',
    }}>
      {value}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workStats, setWorkStats] = useState<DashboardState>({
    totalActivities: 0,
    thisWeekActivities: 0,
    totalHours: 0,
    billableHours: 0,
    needsReviewCount: 0,
    readyToInvoiceAmount: 0,
    readyToInvoiceClientCount: 0,
    readyToInvoiceVisitCount: 0,
    recentActivities: [],
    upcomingActivities: [],
  });
  const [quickStats, setQuickStats] = useState<QuickStats>({
    activeClients: 0,
    hoursThisWeek: 0,
    billableHoursThisWeek: 0,
    visitsThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [workActivitiesRes, clientsRes] = await Promise.all([
          fetch(API_ENDPOINTS.WORK_ACTIVITIES),
          fetch(API_ENDPOINTS.CLIENTS),
        ]);

        const workActivities: WorkActivity[] = await workActivitiesRes.json();
        const clientsData = await clientsRes.json();

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const thisWeekActivities = workActivities.filter((a) => new Date(a.date) >= weekAgo);
        const totalHours = workActivities.reduce((s, a) => s + (a.totalHours || 0), 0);
        const billableHours = workActivities.reduce((s, a) => s + (a.billableHours || 0), 0);
        const needsReviewCount = workActivities.filter((a) => a.status === 'needs_review').length;

        const readyToInvoice = workActivities.filter(
          (a) => a.status === 'completed' && (a.totalCharges || 0) > 0,
        );
        const readyToInvoiceAmount = readyToInvoice.reduce((s, a) => s + (a.totalCharges || 0), 0);
        const readyToInvoiceClientCount = new Set(
          readyToInvoice.map((a) => a.clientId).filter(Boolean),
        ).size;

        const recentActivities = [...workActivities]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 8);

        const upcomingActivities = workActivities
          .filter((a) => a.status === 'planned')
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 5);

        setWorkStats({
          totalActivities: workActivities.length,
          thisWeekActivities: thisWeekActivities.length,
          totalHours,
          billableHours,
          needsReviewCount,
          readyToInvoiceAmount,
          readyToInvoiceClientCount,
          readyToInvoiceVisitCount: readyToInvoice.length,
          recentActivities,
          upcomingActivities,
        });

        setQuickStats({
          activeClients: clientsData.clients?.filter((c: any) => c.activeStatus === 'active').length || 0,
          hoursThisWeek: thisWeekActivities.reduce((s, a) => s + (a.totalHours || 0), 0),
          billableHoursThisWeek: thisWeekActivities.reduce((s, a) => s + (a.billableHours || 0), 0),
          visitsThisWeek: thisWeekActivities.length,
        });
      } catch (err) {
        setError('Failed to load dashboard data. Make sure the backend server is running.');
        // eslint-disable-next-line no-console
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredRecent = useMemo(() => {
    if (activeFilter === 'all') return workStats.recentActivities;
    return workStats.recentActivities.filter((a) => a.status === activeFilter);
  }, [activeFilter, workStats.recentActivities]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const headerEyebrow = useMemo(() => {
    const now = new Date();
    const month = monthLabels[now.getMonth()];
    const date = now.getDate();
    const onejan = new Date(now.getFullYear(), 0, 1).getTime();
    const week = Math.ceil(((now.getTime() - onejan) / 86_400_000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
    const dayFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    return `${dayFull} · ${month} ${date} · WK ${week}`;
  }, []);

  const billableRate = workStats.totalHours > 0
    ? Math.round((100 * workStats.billableHours) / workStats.totalHours)
    : 0;

  if (loading) {
    return (
      <main className="gc-page" style={{ textAlign: 'center', paddingTop: 48 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          Loading dashboard…
        </Typography>
      </main>
    );
  }

  if (error) {
    return (
      <main className="gc-page">
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Typography variant="body2" color="text.secondary">
          This is normal if you haven't started the backend server yet.
        </Typography>
      </main>
    );
  }

  return (
    <main className="gc-page" data-screen-label="Dashboard">
      <div className="gc-page-header">
        <div className="gc-eyebrow">{headerEyebrow}</div>
        <h1>Good morning, {firstName}</h1>
        <div className="sub">
          {workStats.needsReviewCount} {workStats.needsReviewCount === 1 ? 'entry needs' : 'entries need'} review · {formatCurrency(workStats.readyToInvoiceAmount)} ready to invoice this cycle
        </div>
      </div>

      {/* Hero row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <HeroCard
          tone="moss"
          eye="Today's focus"
          title={`${workStats.needsReviewCount} ${workStats.needsReviewCount === 1 ? 'entry needs' : 'entries need'} review`}
          badge={workStats.needsReviewCount > 0 ? workStats.needsReviewCount : undefined}
          body="Notion notes from recent visits are ready to review and roll up into invoices."
          cta="Open review queue"
          Icon={ClipboardCheck}
          onClick={() => navigate('/review')}
        />
        <HeroCard
          tone="terra"
          eye="Billing"
          title={`${formatCurrency(workStats.readyToInvoiceAmount)} ready to invoice`}
          body={`${workStats.readyToInvoiceVisitCount} completed maintenance ${workStats.readyToInvoiceVisitCount === 1 ? 'visit' : 'visits'} across ${workStats.readyToInvoiceClientCount} ${workStats.readyToInvoiceClientCount === 1 ? 'client' : 'clients'} have not yet been invoiced.`}
          cta="Manage invoices"
          Icon={Receipt}
          onClick={() => navigate('/invoices')}
        />
      </div>

      {/* KPI grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <KpiTile label="Total activities" value={workStats.totalActivities} />
        <KpiTile label="This week" value={workStats.thisWeekActivities} sub="activities" />
        <KpiTile label="Hours" value={workStats.totalHours.toFixed(1)} sub="total tracked" />
        <KpiTile
          label="Billable hours"
          value={workStats.billableHours.toFixed(1)}
          trend={{ dir: 'up', text: `${billableRate}% rate` }}
        />
        <KpiTile label="Active clients" value={quickStats.activeClients} sub="active" />
        <KpiTile
          label="Needs review"
          value={workStats.needsReviewCount}
          trend={workStats.needsReviewCount > 0 ? { dir: 'down', text: 'unactioned' } : undefined}
        />
      </div>

      {/* Content split */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 14,
        }}
      >
        <div className="gc-card">
          <div className="gc-card-header">
            <h3>Recent work activities</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTERS.map((f) => {
                const active = activeFilter === f.key;
                return (
                  <button
                    type="button"
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={`gc-chip ${active ? 'solid' : f.tone}`}
                    style={{ cursor: 'pointer', border: active ? 'none' : undefined }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="gc-card-body" style={{ padding: '0 18px' }}>
            {filteredRecent.length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center' }}>
                <Leaf size={28} strokeWidth={1.4} color="var(--moss-300)" />
                <div style={{ marginTop: 8, color: 'var(--fg-muted)', fontSize: 13 }}>
                  Nothing in this view. The queue is clear.
                </div>
              </div>
            ) : (
              filteredRecent.map((a) => (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/work-activities/${a.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/work-activities/${a.id}`); }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr auto',
                    gap: 14,
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--hairline)',
                    cursor: 'pointer',
                  }}
                >
                  <Leaf size={18} strokeWidth={1.6} color="var(--moss-600)" />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="gc-eyebrow">{a.workType.replace(/_/g, ' ')}</span>
                      <span className={`gc-chip ${statusTone(a.status)}`}>
                        <span className="dot" />
                        {a.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--fg-muted)' }}>
                      <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{a.clientName}</span> · {formatDateBriefPacific(a.date)} · {a.totalHours}h
                    </div>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.8} color="var(--fg-subtle)" />
                </div>
              ))
            )}
          </div>
          <div className="gc-card-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="gc-btn ghost"
              onClick={() => navigate('/work-activities')}
            >
              View all activities
              <ArrowRight size={14} strokeWidth={1.8} className="ic" />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="gc-card padded">
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              This week
            </div>
            <StatRow Icon={Building2} label="Active clients" value={quickStats.activeClients} />
            <StatRow Icon={Clock} label="Hours this week" value={`${quickStats.hoursThisWeek.toFixed(1)} h`} />
            <StatRow Icon={Banknote} label="Billable this week" value={`${quickStats.billableHoursThisWeek.toFixed(1)} h`} />
            <StatRow Icon={MapPin} label="Visits this week" value={quickStats.visitsThisWeek} />
          </div>

          <div className="gc-card padded">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>Upcoming</div>
              <span className="gc-chip sky">Next 7 days</span>
            </div>
            {workStats.upcomingActivities.length === 0 ? (
              <Box sx={{ py: 2, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
                No upcoming activities scheduled.
              </Box>
            ) : (
              workStats.upcomingActivities.map((u) => {
                const d = new Date(u.date);
                const day = dayLabels[d.getDay()].toUpperCase();
                const date = d.getDate();
                return (
                  <div
                    key={u.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/work-activities/${u.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/work-activities/${u.id}`); }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 0',
                      borderBottom: '1px solid var(--hairline)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ flexShrink: 0, width: 44, textAlign: 'center', paddingTop: 2 }}>
                      <div style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--fg-muted)',
                      }}>
                        {day}
                      </div>
                      <div className="gc-num-display" style={{ fontSize: 18, color: 'var(--moss-700)' }}>
                        {date}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{u.clientName}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                        {u.workType.replace(/_/g, ' ')} · {u.totalHours}h
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
