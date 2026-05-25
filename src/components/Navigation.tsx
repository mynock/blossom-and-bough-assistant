import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  LineChart,
  FolderOpen,
  Wrench,
  Receipt,
  Users,
  UserRound,
  ClipboardCheck,
  Hammer,
  FolderTree,
  Sparkles,
  RefreshCw,
  Settings,
  Database,
  Banknote,
  Menu as MenuIcon,
  ChevronDown,
  LogOut,
} from '../icons';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

interface NavLeaf {
  path: string;
  label: string;
  Icon: LucideIcon;
}

interface NavGroup {
  key: string;
  label: string;
  Icon: LucideIcon;
  items: NavLeaf[];
}

const TOP_LEVEL: NavLeaf[] = [
  { path: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { path: '/reports', label: 'Reports', Icon: LineChart },
];

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [openDrop, setOpenDrop] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  const groups: NavGroup[] = [
    {
      key: 'resources',
      label: 'Resources',
      Icon: FolderOpen,
      items: [
        { path: '/review', label: 'Review', Icon: ClipboardCheck },
        { path: '/work-activities', label: 'Work', Icon: Hammer },
        { path: '/clients', label: 'Clients', Icon: Users },
        { path: '/projects', label: 'Projects', Icon: FolderTree },
        { path: '/employees', label: 'Helpers', Icon: UserRound },
        { path: '/invoices', label: 'Invoices', Icon: Receipt },
      ],
    },
    {
      key: 'tools',
      label: 'Tools',
      Icon: Wrench,
      items: [
        { path: '/ask-data', label: 'Ask the assistant', Icon: Sparkles },
        { path: '/notion-sync', label: 'Notion sync', Icon: RefreshCw },
        ...(process.env.NODE_ENV !== 'production'
          ? [{ path: '/quickbooks', label: 'QuickBooks', Icon: Banknote }]
          : []),
      ],
    },
    {
      key: 'system',
      label: 'System',
      Icon: Database,
      items: [
        { path: '/settings', label: 'Settings', Icon: Settings },
        { path: '/admin', label: 'Admin', Icon: Settings },
        { path: '/debug', label: 'Debug', Icon: LineChart },
      ],
    },
  ];

  // Close dropdowns when clicking outside the nav
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDrop(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActiveItem = (path: string) => location.pathname === path;
  const isGroupActive = (g: NavGroup) => g.items.some((it) => isActiveItem(it.path));

  const go = (path: string) => {
    navigate(path);
    setOpenDrop(null);
    setMobileDrawerOpen(false);
  };

  return (
    <>
      <header className="gc-appbar">
        {isMobile && (
          <button
            type="button"
            className="gc-iconbtn"
            aria-label="Open menu"
            onClick={() => setMobileDrawerOpen(true)}
          >
            <MenuIcon size={18} strokeWidth={1.6} />
          </button>
        )}

        <a
          className="gc-brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go('/');
          }}
        >
          <span className="mk" aria-hidden="true">
            🌿
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span className="wm">
              Blossom <span className="amp">&amp;</span> Bough
            </span>
            <span className="eye">Garden Care CRM</span>
          </span>
        </a>

        {!isMobile && (
          <nav className="gc-nav" ref={navRef}>
            {TOP_LEVEL.map(({ path, label, Icon }) => {
              const active = isActiveItem(path);
              return (
                <button
                  key={path}
                  type="button"
                  className={['item', active && 'active'].filter(Boolean).join(' ')}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => go(path)}
                >
                  <Icon size={16} strokeWidth={1.6} className="ic" />
                  {label}
                </button>
              );
            })}

            {groups.map((g) => {
              const open = openDrop === g.key;
              const active = isGroupActive(g) || open;
              return (
                <div key={g.key} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className={['item', active && 'active'].filter(Boolean).join(' ')}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDrop(open ? null : g.key);
                    }}
                  >
                    <g.Icon size={16} strokeWidth={1.6} className="ic" />
                    {g.label}
                    <ChevronDown size={14} strokeWidth={1.8} className="caret" />
                  </button>
                  {open && (
                    <div
                      role="menu"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        minWidth: 200,
                        padding: 6,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        boxShadow:
                          '0 2px 4px rgba(58,46,31,0.06), 0 8px 16px rgba(58,46,31,0.08)',
                        zIndex: 50,
                      }}
                    >
                      {g.items.map(({ path, label, Icon }) => {
                        const itemActive = isActiveItem(path);
                        return (
                          <button
                            key={path}
                            type="button"
                            role="menuitem"
                            onClick={() => go(path)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              width: '100%',
                              padding: '8px 10px',
                              border: 'none',
                              background: itemActive ? 'var(--moss-50)' : 'transparent',
                              color: itemActive ? 'var(--moss-900)' : 'var(--fg)',
                              textAlign: 'left',
                              borderRadius: 6,
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                            onMouseEnter={(e) => {
                              if (!itemActive)
                                (e.currentTarget as HTMLButtonElement).style.background =
                                  'var(--bg-inset)';
                            }}
                            onMouseLeave={(e) => {
                              if (!itemActive)
                                (e.currentTarget as HTMLButtonElement).style.background =
                                  'transparent';
                            }}
                          >
                            <Icon
                              size={15}
                              strokeWidth={1.6}
                              className="ic"
                            />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}

        <div className="gc-right">
          <NotificationBell />
          <button
            type="button"
            className="gc-iconbtn"
            style={{ width: 'auto', padding: '0 6px', gap: 6, height: 36 }}
            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
            aria-label="Account menu"
          >
            <span className="gc-avatar">
              {(user?.name?.charAt(0) || '?').toUpperCase()}
            </span>
            {!isMobile && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--fg)',
                  paddingRight: 4,
                }}
              >
                {user?.name?.split(' ')[0]}
              </span>
            )}
          </button>
        </div>
      </header>

      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled>
          <ListItemText primary={user?.name} secondary={user?.email} />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={async () => {
            setUserMenuAnchor(null);
            await logout();
          }}
        >
          <ListItemIcon>
            <LogOut size={16} />
          </ListItemIcon>
          <ListItemText primary="Sign out" />
        </MenuItem>
      </Menu>

      {isMobile && (
        <Drawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
        >
          <Box sx={{ width: 280, py: 2 }}>
            <Box
              sx={{
                px: 2,
                pb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span style={{ fontSize: 22 }} aria-hidden="true">
                🌿
              </span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>
                Blossom <span style={{ color: 'var(--fg-muted)' }}>&amp;</span> Bough
              </span>
            </Box>
            <Divider />
            <List>
              {TOP_LEVEL.map(({ path, label, Icon }) => (
                <ListItem key={path} disablePadding>
                  <ListItemButton
                    onClick={() => go(path)}
                    selected={isActiveItem(path)}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Icon size={18} strokeWidth={1.6} />
                    </ListItemIcon>
                    <ListItemText primary={label} />
                  </ListItemButton>
                </ListItem>
              ))}
              <Divider sx={{ my: 1 }} />
              {groups.map((g, gi) => (
                <Box key={g.key}>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <g.Icon size={18} strokeWidth={1.6} />
                    </ListItemIcon>
                    <ListItemText
                      primary={g.label}
                      primaryTypographyProps={{
                        variant: 'overline',
                        sx: { color: 'text.secondary' },
                      }}
                    />
                  </ListItem>
                  {g.items.map(({ path, label, Icon }) => (
                    <ListItem key={path} disablePadding sx={{ pl: 2 }}>
                      <ListItemButton
                        onClick={() => go(path)}
                        selected={isActiveItem(path)}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Icon size={16} strokeWidth={1.6} />
                        </ListItemIcon>
                        <ListItemText primary={label} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  {gi < groups.length - 1 && <Divider sx={{ my: 1 }} />}
                </Box>
              ))}
            </List>
          </Box>
        </Drawer>
      )}
    </>
  );
};

export default Navigation;
