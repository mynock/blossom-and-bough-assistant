import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  AlertTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
  Tooltip,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Autocomplete,
  Stack
} from '@mui/material';
import {
  Upload as UploadIcon,
  Preview as PreviewIcon,
  Download as ImportIcon,
  ExpandMore as ExpandMoreIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Help as HelpIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

interface ValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
  suggestion?: string;
}

interface ValidatedWorkActivity {
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  employees: string[];
  employeeIds: number[];
  workType: string;
  tasks: string[];
  charges?: Array<{
    type: string;
    description: string;
    cost?: number;
  }>;
  notes: string;
  confidence: number;
  clientId?: number;
  validationIssues: ValidationIssue[];
  canImport: boolean;
}

interface ClientMatch {
  originalName: string;
  matchedClient: { id: number; name: string } | null;
  confidence: number;
  suggestions: Array<{ id: number; name: string; score: number }>;
}

interface EmployeeMatch {
  originalName: string;
  matchedEmployee: { id: number; name: string } | null;
  confidence: number;
}

interface ImportPreview {
  activities: ValidatedWorkActivity[];
  clientMatches: ClientMatch[];
  employeeMatches: EmployeeMatch[];
  summary: {
    totalActivities: number;
    validActivities: number;
    issuesCount: number;
    estimatedImportTime: number;
  };
}

interface ImportTemplates {
  examples: Array<{
    title: string;
    description: string;
    text: string;
  }>;
  patterns: {
    timeFormats: string[];
    employeeCodes: Record<string, string>;
    chargeFormats: string[];
  };
  tips: string[];
}

const WORK_TYPES = [
  'maintenance',
  'installation',
  'design',
  'consultation',
  'pruning',
  'weeding',
  'cleanup',
  'planting',
  'mulching',
  'other'
];

const WorkNotesImport: React.FC = () => {
  const [workNotesText, setWorkNotesText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [editedActivities, setEditedActivities] = useState<ValidatedWorkActivity[]>([]);
  const [templates, setTemplates] = useState<ImportTemplates | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<Set<number>>(new Set());
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [editingActivity, setEditingActivity] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (preview) {
      setEditedActivities([...preview.activities]);
    }
  }, [preview]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/work-notes/templates');
      if (response.ok) {
        const templatesData = await response.json();
        setTemplates(templatesData);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleParseNotes = async () => {
    if (!workNotesText.trim()) {
      showSnackbar('Please enter work notes to parse', 'warning');
      return;
    }

    setParsing(true);
    try {
      const response = await fetch('/api/work-notes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workNotesText })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse work notes');
      }

      const previewData = await response.json();
      setPreview(previewData);
      
      // Select all valid activities by default
      const validActivityIndexes = new Set<number>(
        previewData.activities
          .map((activity: ValidatedWorkActivity, index: number) => activity.canImport ? index : -1)
          .filter((index: number) => index !== -1)
      );
      setSelectedActivities(validActivityIndexes);

      showSnackbar(
        `Parsed ${previewData.summary.totalActivities} activities (${previewData.summary.validActivities} ready to import)`,
        'success'
      );
    } catch (error) {
      console.error('Error parsing work notes:', error);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to parse work notes',
        'error'
      );
    } finally {
      setParsing(false);
    }
  };

  const handleImportActivities = async () => {
    if (!preview || selectedActivities.size === 0) {
      showSnackbar('No activities selected for import', 'warning');
      return;
    }

    const activitiesToImport = Array.from(selectedActivities).map(index => editedActivities[index]);
    
    setImporting(true);
    try {
      const response = await fetch('/api/work-notes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: activitiesToImport })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import activities');
      }

      const results = await response.json();
      
      showSnackbar(
        `Import complete: ${results.imported} imported, ${results.failed} failed`,
        results.failed > 0 ? 'warning' : 'success'
      );

      if (results.imported > 0) {
        // Clear the form after successful import
        setWorkNotesText('');
        setPreview(null);
        setEditedActivities([]);
        setSelectedActivities(new Set());
      }
    } catch (error) {
      console.error('Error importing activities:', error);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to import activities',
        'error'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleActivitySelection = (index: number) => {
    const newSelection = new Set(selectedActivities);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedActivities(newSelection);
  };

  const handleSelectAll = () => {
    if (!preview) return;
    
    const validActivityIndexes = new Set(
      editedActivities
        .map((activity, index) => activity.canImport ? index : -1)
        .filter(index => index !== -1)
    );
    setSelectedActivities(validActivityIndexes);
  };

  const handleDeselectAll = () => {
    setSelectedActivities(new Set());
  };

  const handleEditActivity = (index: number) => {
    setEditingActivity(index);
  };

  const handleSaveActivity = (index: number, updatedActivity: ValidatedWorkActivity) => {
    const newActivities = [...editedActivities];
    newActivities[index] = updatedActivity;
    setEditedActivities(newActivities);
    setEditingActivity(null);
    showSnackbar('Activity updated successfully', 'success');
  };

  const handleCancelEdit = () => {
    setEditingActivity(null);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const getIssueIcon = (type: 'error' | 'warning') => {
    return type === 'error' ? <ErrorIcon color="error" /> : <WarningIcon color="warning" />;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Work Notes Import
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Import work activities from free-form notes using AI parsing. The system will automatically
        match clients, employees, and extract work details. Review and edit each activity before importing.
      </Typography>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Work Notes Input
              </Typography>
              <Tooltip title="View examples and formatting tips">
                <IconButton onClick={() => setShowTemplates(true)}>
                  <HelpIcon />
                </IconButton>
              </Tooltip>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={12}
              value={workNotesText}
              onChange={(e) => setWorkNotesText(e.target.value)}
              placeholder="Paste your work notes here...

Example:
6/3
Time: 8:45-3:10 w V inc 22x2 min drive
Lunch: 12:35-2
Stoller
Work Completed:
- Misc clean up/weeds
- Deadhead brunnera
- Prune choisya (n side)"
              variant="outlined"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={handleParseNotes}
                disabled={parsing || !workNotesText.trim()}
                startIcon={parsing ? undefined : <PreviewIcon />}
                sx={{ flexGrow: 1 }}
              >
                {parsing ? 'Parsing...' : 'Parse Notes'}
              </Button>
              
              <Button
                variant="outlined"
                onClick={() => setShowTemplates(true)}
                startIcon={<HelpIcon />}
              >
                Examples
              </Button>
            </Box>

            {parsing && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  AI is parsing your work notes...
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Preview Section */}
        <Grid item xs={12} md={6}>
          {preview && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Import Preview
              </Typography>

              {/* Summary */}
              <Card sx={{ mb: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2">Total Activities</Typography>
                      <Typography variant="h6">{preview.summary.totalActivities}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">Ready to Import</Typography>
                      <Typography variant="h6">{editedActivities.filter(a => a.canImport).length}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Issues Summary */}
              {preview.summary.issuesCount > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <AlertTitle>Validation Issues Found</AlertTitle>
                  {preview.summary.issuesCount} issues need attention before import.
                  <Button
                    size="small"
                    onClick={() => setShowValidationDetails(true)}
                    sx={{ ml: 1 }}
                  >
                    View Details
                  </Button>
                </Alert>
              )}

              {/* Activity Selection */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <Button size="small" onClick={handleSelectAll}>
                    Select All Valid
                  </Button>
                  <Button size="small" onClick={handleDeselectAll}>
                    Deselect All
                  </Button>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {selectedActivities.size} of {editedActivities.length} activities selected
                </Typography>
              </Box>

              {/* Import Button */}
              <Button
                variant="contained"
                color="success"
                onClick={handleImportActivities}
                disabled={importing || selectedActivities.size === 0}
                startIcon={importing ? undefined : <ImportIcon />}
                fullWidth
                sx={{ mb: 2 }}
              >
                {importing ? 'Importing...' : `Import ${selectedActivities.size} Activities`}
              </Button>

              {importing && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress color="success" />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Importing activities to database...
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </Grid>

        {/* Activities List with Editable Previews */}
        {preview && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Work Activity Drafts - Review & Edit
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Each activity below is a draft based on AI parsing. Click "Edit" to review and modify details before importing.
              </Typography>

              {editedActivities.map((activity, index) => (
                <Card
                  key={index}
                  sx={{
                    mb: 2,
                    border: activity.canImport ? '1px solid' : '1px solid',
                    borderColor: activity.canImport ? 'success.main' : 'error.main',
                    bgcolor: selectedActivities.has(index) ? 'action.selected' : undefined
                  }}
                >
                  <CardContent>
                    {editingActivity === index ? (
                      <ActivityEditForm
                        activity={activity}
                        index={index}
                        onSave={handleSaveActivity}
                        onCancel={handleCancelEdit}
                        clientMatches={preview.clientMatches}
                        employeeMatches={preview.employeeMatches}
                      />
                    ) : (
                      <ActivityPreview
                        activity={activity}
                        index={index}
                        selected={selectedActivities.has(index)}
                        onToggleSelect={handleActivitySelection}
                        onEdit={handleEditActivity}
                        getConfidenceColor={getConfidenceColor}
                        getIssueIcon={getIssueIcon}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Templates Dialog */}
      <Dialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Work Notes Examples & Patterns
          <IconButton
            onClick={() => setShowTemplates(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {templates && (
            <Box>
              {/* Examples */}
              <Typography variant="h6" gutterBottom>
                Examples
              </Typography>
              {templates.examples.map((example, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {example.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {example.description}
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                        {example.text}
                      </Typography>
                    </Paper>
                    <Button
                      size="small"
                      onClick={() => {
                        setWorkNotesText(example.text);
                        setShowTemplates(false);
                      }}
                      sx={{ mt: 1 }}
                    >
                      Use This Example
                    </Button>
                  </CardContent>
                </Card>
              ))}

              <Divider sx={{ my: 3 }} />

              {/* Tips */}
              <Typography variant="h6" gutterBottom>
                Formatting Tips
              </Typography>
              <List>
                {templates.tips.map((tip, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText primary={tip} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Validation Details Dialog */}
      <Dialog
        open={showValidationDetails}
        onClose={() => setShowValidationDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Validation Issues</DialogTitle>
        <DialogContent>
          {preview && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Activity</TableCell>
                    <TableCell>Issue Type</TableCell>
                    <TableCell>Field</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Suggestion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editedActivities.flatMap((activity, actIndex) =>
                    activity.validationIssues.map((issue, issueIndex) => (
                      <TableRow key={`${actIndex}-${issueIndex}`}>
                        <TableCell>{activity.clientName} ({activity.date})</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={issue.type}
                            color={issue.type === 'error' ? 'error' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>{issue.field}</TableCell>
                        <TableCell>{issue.message}</TableCell>
                        <TableCell>{issue.suggestion || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowValidationDetails(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Activity Preview Component
interface ActivityPreviewProps {
  activity: ValidatedWorkActivity;
  index: number;
  selected: boolean;
  onToggleSelect: (index: number) => void;
  onEdit: (index: number) => void;
  getConfidenceColor: (confidence: number) => 'success' | 'warning' | 'error';
  getIssueIcon: (type: 'error' | 'warning') => React.ReactElement;
}

const ActivityPreview: React.FC<ActivityPreviewProps> = ({
  activity,
  index,
  selected,
  onToggleSelect,
  onEdit,
  getConfidenceColor,
  getIssueIcon
}) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={selected}
            onChange={() => onToggleSelect(index)}
            disabled={!activity.canImport}
          />
        }
        label=""
        sx={{ mr: 2 }}
      />
      
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6">
            {activity.clientName}
          </Typography>
          <Chip
            size="small"
            label={activity.date}
            icon={<ScheduleIcon />}
          />
          <Chip
            size="small"
            label={`${activity.totalHours}h`}
            color="primary"
          />
          <Chip
            size="small"
            label={`${Math.round(activity.confidence * 100)}%`}
            color={getConfidenceColor(activity.confidence)}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {activity.startTime} - {activity.endTime} | {activity.employees.join(', ')}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Chip size="small" label={activity.workType} variant="outlined" />
          {activity.charges?.map((charge, chargeIndex) => (
            <Chip
              key={chargeIndex}
              size="small"
              label={charge.description}
              icon={<MoneyIcon />}
              color="secondary"
            />
          ))}
        </Box>

        {activity.tasks.length > 0 && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Tasks:</strong> {activity.tasks.join(', ')}
          </Typography>
        )}

        {activity.notes && (
          <Typography variant="body2" color="text.secondary">
            <strong>Notes:</strong> {activity.notes}
          </Typography>
        )}
      </Box>

      <Stack direction="row" spacing={1}>
        <Tooltip title="Edit activity details">
          <IconButton onClick={() => onEdit(index)} color="primary">
            <EditIcon />
          </IconButton>
        </Tooltip>
        {!activity.canImport && (
          <Tooltip title="Has validation issues">
            <ErrorIcon color="error" />
          </Tooltip>
        )}
      </Stack>
    </Box>

    {/* Validation Issues */}
    {activity.validationIssues.length > 0 && (
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" color="error">
            {activity.validationIssues.length} Validation Issue(s)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List dense>
            {activity.validationIssues.map((issue, issueIndex) => (
              <ListItem key={issueIndex}>
                <ListItemIcon>
                  {getIssueIcon(issue.type)}
                </ListItemIcon>
                <ListItemText
                  primary={issue.message}
                  secondary={issue.suggestion}
                />
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>
    )}
  </Box>
);

// Activity Edit Form Component
interface ActivityEditFormProps {
  activity: ValidatedWorkActivity;
  index: number;
  onSave: (index: number, activity: ValidatedWorkActivity) => void;
  onCancel: () => void;
  clientMatches: ClientMatch[];
  employeeMatches: EmployeeMatch[];
}

const ActivityEditForm: React.FC<ActivityEditFormProps> = ({
  activity,
  index,
  onSave,
  onCancel,
  clientMatches,
  employeeMatches
}) => {
  const [editedActivity, setEditedActivity] = useState<ValidatedWorkActivity>({ ...activity });

  const handleSave = () => {
    onSave(index, editedActivity);
  };

  const updateField = (field: keyof ValidatedWorkActivity, value: any) => {
    setEditedActivity(prev => ({ ...prev, [field]: value }));
  };

  const updateTasks = (taskText: string) => {
    const tasks = taskText.split('\n').filter(task => task.trim());
    updateField('tasks', tasks);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon /> Edit Work Activity
      </Typography>
      
      <Grid container spacing={2}>
        {/* Basic Info */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Client Name"
            value={editedActivity.clientName}
            onChange={(e) => updateField('clientName', e.target.value)}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Date"
            type="date"
            value={editedActivity.date}
            onChange={(e) => updateField('date', e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        {/* Time Info */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Start Time"
            type="time"
            value={editedActivity.startTime}
            onChange={(e) => updateField('startTime', e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="End Time"
            type="time"
            value={editedActivity.endTime}
            onChange={(e) => updateField('endTime', e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Total Hours"
            type="number"
            value={editedActivity.totalHours}
            onChange={(e) => updateField('totalHours', parseFloat(e.target.value) || 0)}
            margin="normal"
            inputProps={{ step: 0.25, min: 0 }}
          />
        </Grid>

        {/* Work Type */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Work Type</InputLabel>
            <Select
              value={editedActivity.workType}
              onChange={(e) => updateField('workType', e.target.value)}
              label="Work Type"
            >
              {WORK_TYPES.map(type => (
                <MenuItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Employees */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Employees (comma separated)"
            value={editedActivity.employees.join(', ')}
            onChange={(e) => updateField('employees', e.target.value.split(',').map(emp => emp.trim()).filter(emp => emp))}
            margin="normal"
            helperText="e.g., Virginia, Rebecca, Anne"
          />
        </Grid>

        {/* Tasks */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Tasks"
            multiline
            rows={3}
            value={editedActivity.tasks.join('\n')}
            onChange={(e) => updateTasks(e.target.value)}
            margin="normal"
            helperText="Enter each task on a new line"
          />
        </Grid>

        {/* Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={2}
            value={editedActivity.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            margin="normal"
          />
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              startIcon={<SaveIcon />}
              color="primary"
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              onClick={onCancel}
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default WorkNotesImport; 