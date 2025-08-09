import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
} from '@mui/material';
import {
  AccessTime,
  Schedule,
  DriveEta,
  FreeBreakfast,
  Assignment,
  TrendingUp,
} from '@mui/icons-material';
import { ReportSummary } from '../../services/api';

interface SummaryCardsProps {
  summary: ReportSummary;
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  subtitle?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, color, subtitle }) => (
  <Card elevation={2} sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Avatar sx={{ bgcolor: color, mr: 2 }}>
          {icon}
        </Avatar>
        <Box>
          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
            {typeof value === 'number' ? value.toFixed(2) : value}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const cards = [
    {
      title: 'Total Billable Hours',
      value: summary.totalBillableHours,
      icon: <AccessTime />,
      color: '#2e7d32', // Primary green
    },
    {
      title: 'Total Hours Worked',
      value: summary.totalHours,
      icon: <Schedule />,
      color: '#558b2f', // Secondary green
    },
    {
      title: 'Travel Time',
      value: summary.totalTravelTimeHours,
      icon: <DriveEta />,
      color: '#ff9800', // Orange
      subtitle: 'hours',
    },
    {
      title: 'Break Time',
      value: summary.totalBreakTimeHours,
      icon: <FreeBreakfast />,
      color: '#2196f3', // Blue
      subtitle: 'hours',
    },
    {
      title: 'Total Activities',
      value: summary.totalActivities,
      icon: <Assignment />,
      color: '#9c27b0', // Purple
    },
    {
      title: 'Avg Hours/Activity',
      value: summary.averageHoursPerActivity,
      icon: <TrendingUp />,
      color: '#f44336', // Red
    },
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={4} lg={2} key={index}>
          <SummaryCard {...card} />
        </Grid>
      ))}
    </Grid>
  );
};

export default SummaryCards;
