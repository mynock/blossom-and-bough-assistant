import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Box, Paper, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';

interface BreakdownChartProps {
  data: Array<{
    name: string;
    value: number;
    [key: string]: any;
  }>;
  title: string;
  dataKey: string;
  height?: number;
  showToggle?: boolean;
  color?: string;
}

const COLORS = [
  '#2e7d32', // Primary green
  '#558b2f', // Secondary green
  '#689f38', // Light green
  '#7cb342', // Lighter green
  '#8bc34a', // Even lighter green
  '#9ccc65', // Very light green
  '#aed581', // Pale green
  '#c5e1a5', // Very pale green
];

const BreakdownChart: React.FC<BreakdownChartProps> = ({
  data,
  title,
  dataKey,
  height = 400,
  showToggle = true,
  color = '#2e7d32',
}) => {
  const [chartType, setChartType] = React.useState<'bar' | 'pie'>('bar');

  const handleChartTypeChange = (
    event: React.MouseEvent<HTMLElement>,
    newType: 'bar' | 'pie' | null,
  ) => {
    if (newType !== null) {
      setChartType(newType);
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
            {label || payload[0]?.payload?.name}
          </Typography>
          <Typography variant="body2" sx={{ color: payload[0]?.color }}>
            {payload[0]?.name}: {payload[0]?.value?.toFixed(2)} hours
          </Typography>
        </Paper>
      );
    }
    return null;
  };

  const renderBarChart = () => (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="name"
          stroke="#666"
          fontSize={12}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis 
          label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
          stroke="#666"
          fontSize={12}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderPieChart = () => (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
          outerRadius={120}
          fill="#8884d8"
          dataKey={dataKey}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          {title}
        </Typography>
        {showToggle && (
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={handleChartTypeChange}
            size="small"
          >
            <ToggleButton value="bar">Bar Chart</ToggleButton>
            <ToggleButton value="pie">Pie Chart</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>
      <Box sx={{ width: '100%', height: height }}>
        {chartType === 'bar' ? renderBarChart() : renderPieChart()}
      </Box>
    </Paper>
  );
};

export default BreakdownChart;
