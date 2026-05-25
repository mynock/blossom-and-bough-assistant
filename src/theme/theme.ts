import { createTheme } from '@mui/material/styles';
import {
  moss,
  bark,
  stone,
  paper,
  terracotta,
  honey,
  bloom,
  sky,
  border,
  shadow,
  fontFamily,
} from './tokens';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: moss[700], dark: moss[800], light: moss[600], contrastText: paper.linen },
    secondary: { main: terracotta[600], dark: terracotta[700], light: terracotta[500], contrastText: paper.linen },
    success: { main: moss[600], contrastText: paper.linen },
    warning: { main: honey[600], contrastText: bark[900] },
    info: { main: sky[600], contrastText: paper.linen },
    error: { main: bloom[600], contrastText: paper.linen },
    background: { default: paper.mist, paper: paper.chalk },
    text: { primary: bark[900], secondary: stone[500], disabled: stone[300] },
    divider: border.base,
  },
  typography: {
    fontFamily: fontFamily.sans,
    h1: { fontWeight: 600, fontSize: 24, lineHeight: 1.2, letterSpacing: '-0.01em' },
    h2: { fontWeight: 600, fontSize: 18, lineHeight: 1.3, letterSpacing: '-0.005em' },
    h3: { fontWeight: 600, fontSize: 15, lineHeight: 1.4 },
    h4: { fontWeight: 600, fontSize: 13, lineHeight: 1.4 },
    h5: { fontWeight: 600, fontSize: 13, lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: 12, lineHeight: 1.4 },
    body1: { fontSize: 13.5, lineHeight: 1.5 },
    body2: { fontSize: 12.5, lineHeight: 1.45 },
    caption: { fontSize: 11.5, color: stone[500] },
    overline: { fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, lineHeight: 1.4 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: paper.mist,
          color: bark[900],
          fontFamily: fontFamily.sans,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    MuiAppBar: {
      defaultProps: { position: 'sticky', elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          minHeight: 56,
          background: 'rgba(251, 247, 238, 0.85)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          borderBottom: `1px solid ${border.base}`,
          boxShadow: 'none',
          color: bark[900],
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: { minHeight: 56, '@media (min-width:600px)': { minHeight: 56 } },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 10,
          border: `1px solid ${border.base}`,
          boxShadow: shadow.sm,
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableRipple: true, disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 7,
          minHeight: 36,
          height: 36,
          paddingLeft: 14,
          paddingRight: 14,
        },
        sizeSmall: { height: 32, minHeight: 32, fontSize: 12.5 },
        sizeLarge: { height: 44, minHeight: 44, fontSize: 14.5 },
        containedPrimary: {
          backgroundColor: moss[700],
          color: paper.linen,
          '&:hover': { backgroundColor: moss[800] },
        },
        containedSecondary: {
          backgroundColor: terracotta[600],
          color: paper.linen,
          '&:hover': { backgroundColor: terracotta[700] },
        },
        outlined: {
          borderColor: border.strong,
          color: bark[900],
          '&:hover': { backgroundColor: '#EFEADC', borderColor: border.strong },
        },
        text: {
          color: bark[900],
          '&:hover': { backgroundColor: '#EFEADC' },
        },
      },
    },
    MuiIconButton: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          borderRadius: 7,
          color: stone[500],
          '&:hover': { backgroundColor: '#EFEADC', color: bark[900] },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          height: 22,
          borderRadius: 999,
          fontSize: 11.5,
          fontWeight: 500,
          letterSpacing: '0.01em',
          backgroundColor: paper.parchment,
          color: bark[900],
          border: `1px solid ${border.base}`,
        },
        label: { paddingLeft: 9, paddingRight: 9 },
        colorPrimary: { backgroundColor: moss[100], color: moss[900], borderColor: 'rgba(47,82,51,0.18)' },
        colorSecondary: { backgroundColor: terracotta[100], color: '#5C2A14', borderColor: 'rgba(156,79,46,0.22)' },
        colorSuccess: { backgroundColor: moss[100], color: moss[900], borderColor: 'rgba(47,82,51,0.18)' },
        colorWarning: { backgroundColor: honey[100], color: '#5C3F10', borderColor: 'rgba(156,116,48,0.22)' },
        colorInfo: { backgroundColor: sky[100], color: '#1F3A55', borderColor: 'rgba(53,87,120,0.18)' },
        colorError: { backgroundColor: bloom[100], color: '#5C1A12', borderColor: 'rgba(122,39,28,0.20)' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          backgroundColor: paper.chalk,
          fontSize: 13,
          '& fieldset': { borderColor: border.strong },
          '&:hover fieldset': { borderColor: stone[400] },
          '&.Mui-focused fieldset': {
            borderColor: moss[700],
            boxShadow: '0 0 0 3px rgba(47,82,51,0.15)',
          },
        },
        input: { padding: '8px 11px', height: 16 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: paper.parchment,
          '& .MuiTableCell-head': {
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: stone[500],
            borderBottom: `1px solid ${border.base}`,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&.MuiTableRow-hover:hover': { backgroundColor: paper.mist },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        body: {
          fontSize: 12.5,
          borderBottom: `1px solid ${border.hairline}`,
          color: bark[900],
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          boxShadow: shadow.lg,
          padding: 0,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: bark[900],
          color: paper.linen,
          borderRadius: 6,
          fontSize: 11.5,
        },
        arrow: { color: bark[900] },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: paper.parchment,
          borderRight: `1px solid ${border.base}`,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
          border: `1px solid ${border.base}`,
          boxShadow: shadow.md,
          marginTop: 4,
        },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          minHeight: 32,
          fontSize: 13,
          '&:hover': { backgroundColor: '#EFEADC' },
        },
      },
    },
  },
});
