import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Box, Paper, Typography } from '@mui/material';
import { format, parseISO } from 'date-fns';
import { TimeSeriesDataPoint } from '../../services/api';

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  title: string;
  dataKeys: Array<{
    key: keyof TimeSeriesDataPoint;
    name: string;
    color: string;
  }>;
  height?: number;
  yAxisLabel?: string;
  showGrid?: boolean;
  groupBy?: string;
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  title,
  dataKeys,
  height = 400,
  yAxisLabel = 'Hours',
  showGrid = true,
  groupBy = 'day',
}) => {
  const formatXAxisLabel = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      switch (groupBy) {
        case 'week':
          return format(date, 'MMM dd');
        case 'month':
          return format(date, 'MMM yyyy');
        case 'year':
          return format(date, 'yyyy');
        default: // day
          return format(date, 'MMM dd');
      }
    } catch {
      return dateString;
    }
  };

  const formatTooltipLabel = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      switch (groupBy) {
        case 'week':
          return `Week of ${format(date, 'MMM dd, yyyy')}`;
        case 'month':
          return format(date, 'MMMM yyyy');
        case 'year':
          return format(date, 'yyyy');
        default: // day
          return format(date, 'EEEE, MMM dd, yyyy');
      }
    } catch {
      return dateString;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper 
          elevation={3} 
          sx={{ 
            p: 2, 
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {formatTooltipLabel(label)}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Typography
              key={index}
              variant="body2"
              sx={{ color: entry.color }}
            >
              {entry.name}: {entry.value.toFixed(2)} hours
            </Typography>
          ))}
        </Paper>
      );
    }
    return null;
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
        {title}
      </Typography>
      <Box sx={{ width: '100%', height: height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
            <XAxis 
              dataKey="date"
              tickFormatter={formatXAxisLabel}
              stroke="#666"
              fontSize={12}
            />
            <YAxis 
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
              stroke="#666"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {dataKeys.map((dataKey) => (
              <Line
                key={dataKey.key}
                type="monotone"
                dataKey={dataKey.key}
                stroke={dataKey.color}
                strokeWidth={2}
                dot={{ strokeWidth: 2, r: 4 }}
                name={dataKey.name}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default TimeSeriesChart;
