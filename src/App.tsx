import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import Dashboard from './components/Dashboard';
import Chat from './components/Chat';
import Schedule from './components/Schedule';
import Debug from './components/Debug';
import ClientManagement from './components/ClientManagement';
import EmployeeManagement from './components/EmployeeManagement';
import ProjectManagement from './components/ProjectManagement';
import WorkActivityManagement from './components/WorkActivityManagement';
import WorkNotesImport from './components/WorkNotesImport';
import Navigation from './components/Navigation';
import Login from './components/Login';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2e7d32', // Green theme for landscaping
    },
    secondary: {
      main: '#558b2f',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
      color: '#2e7d32',
    },
    h5: {
      fontWeight: 500,
      color: '#2e7d32',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AuthProvider>
          <Router>
            <div className="App">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/*" element={
                  <ProtectedRoute>
                    <Navigation />
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/clients" element={<ClientManagement />} />
                      <Route path="/employees" element={<EmployeeManagement />} />
                      <Route path="/projects" element={<ProjectManagement />} />
                      <Route path="/work-activities" element={<WorkActivityManagement />} />
                      <Route path="/work-notes-import" element={<WorkNotesImport />} />
                      <Route path="/debug" element={<Debug />} />
                    </Routes>
                  </ProtectedRoute>
                } />
              </Routes>
            </div>
          </Router>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App; 