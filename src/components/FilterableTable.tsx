import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  IconButton,
  Autocomplete,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

export interface FilterConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'daterange' | 'autocomplete';
  options?: Array<{ value: any; label: string }>;
  getOptionLabel?: (option: any) => string;
}

export interface ColumnConfig<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

interface FilterableTableProps<T> {
  data: T[];
  columns: ColumnConfig<T>[];
  filters: FilterConfig[];
  onRowAction?: (action: string, row: T) => void;
  actions?: Array<{
    key: string;
    label: string;
    icon?: React.ReactNode;
    color?: 'primary' | 'secondary' | 'default' | 'error' | 'warning' | 'info' | 'success';
  }>;
  initialSortBy?: string;
  initialSortOrder?: 'asc' | 'desc';
  rowKeyField: keyof T;
  emptyMessage?: string;
  title?: React.ReactNode;
  headerActions?: React.ReactNode;
}

export function FilterableTable<T>({
  data,
  columns,
  filters,
  onRowAction,
  actions = [],
  initialSortBy,
  initialSortOrder = 'asc',
  rowKeyField,
  emptyMessage = 'No data available',
  title,
  headerActions,
}: FilterableTableProps<T>) {
  const [sortBy, setSortBy] = useState<string>(initialSortBy || '');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Handle sorting
  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('asc');
    }
  };

  // Handle filter changes
  const handleFilterChange = (filterKey: string, value: any) => {
    setFilterValues((prev: Record<string, any>) => ({
      ...prev,
      [filterKey]: value,
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterValues({});
  };

  // Get nested property value
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  // Filter and sort data
  const processedData = useMemo(() => {
    // Ensure data is an array to prevent filter errors
    if (!Array.isArray(data)) {
      console.warn('FilterableTable: data prop is not an array:', data);
      return [];
    }
    
    let filtered = data.filter(item => {
      return filters.every(filter => {
        const filterValue = filterValues[filter.key];
        if (!filterValue || filterValue === '' || 
            (Array.isArray(filterValue) && filterValue.length === 0)) {
          return true;
        }

        const itemValue = getNestedValue(item, filter.key);

        switch (filter.type) {
          case 'text':
            return itemValue?.toString().toLowerCase().includes(filterValue.toLowerCase());
          
          case 'select':
            return itemValue === filterValue;
          
          case 'multiselect':
            return Array.isArray(filterValue) ? (filterValue as any[]).includes(itemValue) : itemValue === filterValue;
          
          case 'autocomplete':
            if (Array.isArray(filterValue)) {
              // Special handling for arrays like employeesList
              if (Array.isArray(itemValue)) {
                return filterValue.some(selected => 
                  itemValue.some((item: any) => 
                    filter.getOptionLabel ? 
                    filter.getOptionLabel(selected) === filter.getOptionLabel?.(item) :
                    selected === item
                  )
                );
              }
              return filterValue.some(selected => 
                filter.getOptionLabel ? 
                filter.getOptionLabel(selected) === filter.getOptionLabel?.(itemValue) :
                selected === itemValue
              );
            }
            return filter.getOptionLabel ? 
              filter.getOptionLabel(filterValue) === filter.getOptionLabel?.(itemValue) :
              filterValue === itemValue;
          
          case 'daterange':
            if (filterValue.startDate && filterValue.endDate) {
              const itemDate = new Date(itemValue);
              const startDate = new Date(filterValue.startDate);
              const endDate = new Date(filterValue.endDate);
              return itemDate >= startDate && itemDate <= endDate;
            }
            return true;
          
          default:
            return true;
        }
      });
    });

    // Sort data
    if (sortBy) {
      filtered.sort((a, b) => {
        const aValue = getNestedValue(a, sortBy);
        const bValue = getNestedValue(b, sortBy);
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, filterValues, sortBy, sortOrder, filters]);

  // Count active filters
  const activeFiltersCount = Object.values(filterValues).filter((value: any) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some((v: any) => v !== '' && v !== null && v !== undefined);
    }
    return value !== '' && value !== null && value !== undefined;
  }).length;

  // Render filter input based on type
  const renderFilterInput = (filter: FilterConfig) => {
    const value = filterValues[filter.key] || '';

    switch (filter.type) {
      case 'text':
        return (
          <TextField
            label={filter.label}
            value={value}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            fullWidth
            size="small"
          />
        );

      case 'select':
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{filter.label}</InputLabel>
            <Select
              value={value}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              label={filter.label}
            >
              <MenuItem value="">All</MenuItem>
              {filter.options?.map((option) => (
                <MenuItem key={String(option.value)} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'multiselect':
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{filter.label}</InputLabel>
            <Select
              multiple
              value={Array.isArray(value) ? value : []}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              label={filter.label}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as any[]).map((val) => {
                    const option = filter.options?.find(opt => opt.value === val);
                    return (
                      <Chip key={String(val)} label={option?.label || String(val)} size="small" />
                    );
                  })}
                </Box>
              )}
            >
              {filter.options?.map((option) => (
                <MenuItem key={String(option.value)} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'autocomplete':
        return (
          <Autocomplete
            multiple
            value={Array.isArray(value) ? value : []}
            onChange={(event, newValue) => handleFilterChange(filter.key, newValue)}
            options={filter.options?.map(opt => opt.value) || []}
            getOptionLabel={(option: any) => 
              filter.getOptionLabel ? filter.getOptionLabel(option) : String(option)
            }
            renderInput={(params: any) => (
              <TextField {...params} label={filter.label} size="small" />
            )}
            renderTags={(value: any[], getTagProps: any) =>
              value.map((option: any, index: number) => (
                <Chip
                  key={index}
                  label={filter.getOptionLabel ? filter.getOptionLabel(option) : String(option)}
                  size="small"
                  {...getTagProps({ index })}
                />
              ))
            }
          />
        );

      case 'daterange':
        return (
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <TextField
                label="From Date"
                type="date"
                value={value?.startDate || ''}
                onChange={(e) => handleFilterChange(filter.key, { ...value, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="To Date"
                type="date"
                value={value?.endDate || ''}
                onChange={(e) => handleFilterChange(filter.key, { ...value, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Header */}
      {(title || headerActions) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          {title && (
            typeof title === 'string' ? (
              <Typography variant="h4">{title}</Typography>
            ) : (
              <Typography variant="h4" component="div">{title}</Typography>
            )
          )}
          {headerActions}
        </Box>
      )}

      {/* Filters */}
      <Paper sx={{ mb: 2 }}>
        <Accordion expanded={filtersExpanded} onChange={(e, expanded) => setFiltersExpanded(expanded)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon />
              <Typography>
                Filters
                {activeFiltersCount > 0 && (
                  <Chip 
                    label={activeFiltersCount} 
                    size="small" 
                    color="primary" 
                    sx={{ ml: 1 }} 
                  />
                )}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {filters.map((filter) => (
                <Grid item xs={12} sm={6} md={4} key={filter.key}>
                  {renderFilterInput(filter)}
                </Grid>
              ))}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button
                    onClick={clearFilters}
                    startIcon={<ClearIcon />}
                    variant="outlined"
                    size="small"
                    disabled={activeFiltersCount === 0}
                  >
                    Clear All Filters
                  </Button>
                  <Typography variant="body2" sx={{ alignSelf: 'center', color: 'text.secondary' }}>
                    Showing {processedData.length} of {Array.isArray(data) ? data.length : 0} records
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={String(column.key)}
                  align={column.align || 'left'}
                  style={{ width: column.width }}
                >
                  {column.sortable ? (
                    <TableSortLabel
                      active={sortBy === column.key}
                      direction={sortBy === column.key ? sortOrder : 'asc'}
                      onClick={() => handleSort(String(column.key))}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              {actions.length > 0 && <TableCell align="center">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {processedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions.length > 0 ? 1 : 0)} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              processedData.map((row) => (
                <TableRow key={String(row[rowKeyField])}>
                  {columns.map((column) => (
                    <TableCell key={String(column.key)} align={column.align || 'left'}>
                      {column.render ? 
                        column.render(row) : 
                        String(getNestedValue(row, String(column.key)) || '')
                      }
                    </TableCell>
                  ))}
                  {actions.length > 0 && (
                    <TableCell align="center">
                      {actions.map((action) => (
                        <IconButton
                          key={action.key}
                          onClick={() => onRowAction?.(action.key, row)}
                          size="small"
                          color={action.color || 'default'}
                          title={action.label}
                        >
                          {action.icon}
                        </IconButton>
                      ))}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default FilterableTable;