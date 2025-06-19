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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
  IconButton,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Preview as PreviewIcon,
  Download as ImportIcon,
  ExpandMore as ExpandMoreIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Help as HelpIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Check as AcceptIcon,
  Clear as RejectIcon,
  FileUpload as FileUploadIcon,
  TextFields as TextIcon,
  Description as FileIcon
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

interface ImportPreview {
  activities: ValidatedWorkActivity[];
  summary: {
    totalActivities: number;
    validActivities: number;
    issuesCount: number;
    estimatedImportTime: number;
  };
  sourceFile?: {
    name: string;
    size: number;
    type: string;
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

type ImportStep = 'upload' | 'review' | 'complete';

const WorkNotesImport: React.FC = () => {
  // Main workflow state
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [importMethod, setImportMethod] = useState<'text' | 'file'>('file');
  
  // Upload state
  const [workNotesText, setWorkNotesText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Review state
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [activities, setActivities] = useState<ValidatedWorkActivity[]>([]);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [editingActivity, setEditingActivity] = useState<ValidatedWorkActivity | null>(null);
  const [activityDecisions, setActivityDecisions] = useState<Record<number, 'accept' | 'reject' | 'pending'>>({});
  
  // Import state
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  
  // UI state
  const [templates, setTemplates] = useState<ImportTemplates | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
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
      setActivities([...preview.activities]);
      setCurrentActivityIndex(0);
      // Initialize all activities as pending
      const initialDecisions: Record<number, 'accept' | 'reject' | 'pending'> = {};
      preview.activities.forEach((_, index) => {
        initialDecisions[index] = 'pending';
      });
      setActivityDecisions(initialDecisions);
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (importMethod === 'file' && !selectedFile) {
      showSnackbar('Please select a file to upload', 'warning');
      return;
    }

    if (importMethod === 'text' && !workNotesText.trim()) {
      showSnackbar('Please enter work notes to parse', 'warning');
      return;
    }

    setUploading(true);
    try {
      let response;

      if (importMethod === 'file') {
        const formData = new FormData();
        formData.append('file', selectedFile!);

        response = await fetch('/api/work-notes/upload', {
          method: 'POST',
          body: formData
        });
      } else {
        response = await fetch('/api/work-notes/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workNotesText })
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process work notes');
      }

      const previewData = await response.json();
      setPreview(previewData);
      setCurrentStep('review');

      showSnackbar(
        `Parsed ${previewData.summary.totalActivities} activities successfully`,
        'success'
      );
    } catch (error) {
      console.error('Error processing work notes:', error);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to process work notes',
        'error'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleActivityDecision = (decision: 'accept' | 'reject') => {
    const newDecisions = { ...activityDecisions };
    newDecisions[currentActivityIndex] = decision;
    setActivityDecisions(newDecisions);

    // Auto-advance to next pending activity
    const nextPendingIndex = activities.findIndex((_, index) => 
      index > currentActivityIndex && newDecisions[index] === 'pending'
    );
    
    if (nextPendingIndex !== -1) {
      setCurrentActivityIndex(nextPendingIndex);
    } else {
      // Check if all activities have been decided
      const allDecided = activities.every((_, index) => newDecisions[index] !== 'pending');
      if (allDecided) {
        showSnackbar('All activities reviewed! Ready to import.', 'success');
      }
    }
  };

  const handleSaveEdit = () => {
    if (editingActivity) {
      const newActivities = [...activities];
      newActivities[currentActivityIndex] = editingActivity;
      setActivities(newActivities);
      setEditingActivity(null);
      showSnackbar('Activity updated successfully', 'success');
    }
  };

  const handleImportActivities = async () => {
    const acceptedActivities = activities.filter((_, index) => 
      activityDecisions[index] === 'accept'
    );

    if (acceptedActivities.length === 0) {
      showSnackbar('No activities accepted for import', 'warning');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch('/api/work-notes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: acceptedActivities })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import activities');
      }

      const results = await response.json();
      setImportResults(results);
      setCurrentStep('complete');

      showSnackbar(
        `Import complete: ${results.imported} imported, ${results.failed} failed`,
        results.failed > 0 ? 'warning' : 'success'
      );
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

  const handleStartOver = () => {
    setCurrentStep('upload');
    setPreview(null);
    setActivities([]);
    setCurrentActivityIndex(0);
    setActivityDecisions({});
    setEditingActivity(null);
    setImportResults(null);
    setSelectedFile(null);
    setWorkNotesText('');
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const currentActivity = activities[currentActivityIndex];
  const acceptedCount = Object.values(activityDecisions).filter(d => d === 'accept').length;
  const rejectedCount = Object.values(activityDecisions).filter(d => d === 'reject').length;
  const pendingCount = Object.values(activityDecisions).filter(d => d === 'pending').length;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Work Notes Import
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Import work activities from files or text using AI parsing. Review and edit each activity before importing.
      </Typography>

      <Stepper activeStep={currentStep === 'upload' ? 0 : currentStep === 'review' ? 1 : 2} sx={{ mb: 4 }}>
        <Step>
          <StepLabel>Upload & Parse</StepLabel>
        </Step>
        <Step>
          <StepLabel>Review Activities</StepLabel>
        </Step>
        <Step>
          <StepLabel>Import Complete</StepLabel>
        </Step>
      </Stepper>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Choose Import Method
              </Typography>
              
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <Button
                  variant={importMethod === 'file' ? 'contained' : 'outlined'}
                  onClick={() => setImportMethod('file')}
                  startIcon={<FileUploadIcon />}
                  fullWidth
                >
                  Upload File
                </Button>
                <Button
                  variant={importMethod === 'text' ? 'contained' : 'outlined'}
                  onClick={() => setImportMethod('text')}
                  startIcon={<TextIcon />}
                  fullWidth
                >
                  Enter Text
                </Button>
              </Stack>

              {importMethod === 'file' ? (
                <Box>
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Card
                      sx={{
                        p: 4,
                        textAlign: 'center',
                        border: '2px dashed',
                        borderColor: selectedFile ? 'primary.main' : 'grey.300',
                        bgcolor: selectedFile ? 'primary.light' : 'grey.50',
                        cursor: 'pointer',
                        mb: 2,
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'primary.light'
                        }
                      }}
                    >
                      <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        {selectedFile ? selectedFile.name : 'Click to upload file'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedFile 
                          ? `${(selectedFile.size / 1024).toFixed(1)} KB - ${selectedFile.type}`
                          : 'Supports PDF and text files (max 32MB)'
                        }
                      </Typography>
                    </Card>
                  </label>
                </Box>
              ) : (
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
              )}

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  disabled={uploading || (importMethod === 'file' ? !selectedFile : !workNotesText.trim())}
                  startIcon={uploading ? undefined : <PreviewIcon />}
                  sx={{ flexGrow: 1 }}
                >
                  {uploading ? 'Processing...' : 'Parse Notes'}
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={() => setShowTemplates(true)}
                  startIcon={<HelpIcon />}
                >
                  Examples
                </Button>
              </Box>

              {uploading && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    AI is analyzing your work notes...
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                How it works
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon><FileIcon color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Upload or paste your work notes"
                    secondary="Supports handwritten PDFs, typed documents, or plain text"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><PreviewIcon color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="AI parses and structures the data"
                    secondary="Extracts clients, dates, times, tasks, and charges automatically"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><EditIcon color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Review and edit each activity"
                    secondary="Cycle through activities one-by-one to verify and correct"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><ImportIcon color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Import approved activities"
                    secondary="Only activities you approve are added to the database"
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Review Step */}
      {currentStep === 'review' && currentActivity && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Review Activity {currentActivityIndex + 1} of {activities.length}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip size="small" label={`${acceptedCount} accepted`} color="success" />
                  <Chip size="small" label={`${rejectedCount} rejected`} color="error" />
                  <Chip size="small" label={`${pendingCount} pending`} color="default" />
                </Box>
              </Box>

              {editingActivity ? (
                <ActivityEditForm
                  activity={editingActivity}
                  onChange={setEditingActivity}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditingActivity(null)}
                />
              ) : (
                <ActivityReviewCard
                  activity={currentActivity}
                  onEdit={() => setEditingActivity({ ...currentActivity })}
                  getConfidenceColor={getConfidenceColor}
                />
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={() => setCurrentActivityIndex(Math.max(0, currentActivityIndex - 1))}
                  disabled={currentActivityIndex === 0}
                  startIcon={<PrevIcon />}
                >
                  Previous
                </Button>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => handleActivityDecision('accept')}
                    disabled={activityDecisions[currentActivityIndex] === 'accept'}
                    startIcon={<AcceptIcon />}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => handleActivityDecision('reject')}
                    disabled={activityDecisions[currentActivityIndex] === 'reject'}
                    startIcon={<RejectIcon />}
                  >
                    Reject
                  </Button>
                </Box>

                <Button
                  variant="outlined"
                  onClick={() => setCurrentActivityIndex(Math.min(activities.length - 1, currentActivityIndex + 1))}
                  disabled={currentActivityIndex === activities.length - 1}
                  endIcon={<NextIcon />}
                >
                  Next
                </Button>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Import Summary
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Progress</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={((acceptedCount + rejectedCount) / activities.length) * 100}
                  sx={{ mt: 1 }}
                />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {acceptedCount + rejectedCount} of {activities.length} reviewed
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Activities to import:</strong> {acceptedCount}
                </Typography>
                <Typography variant="body2">
                  <strong>Activities rejected:</strong> {rejectedCount}
                </Typography>
                <Typography variant="body2">
                  <strong>Pending review:</strong> {pendingCount}
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="primary"
                onClick={handleImportActivities}
                disabled={acceptedCount === 0 || importing}
                startIcon={importing ? undefined : <ImportIcon />}
                fullWidth
                sx={{ mt: 2 }}
              >
                {importing ? 'Importing...' : `Import ${acceptedCount} Activities`}
              </Button>

              <Button
                variant="outlined"
                onClick={handleStartOver}
                fullWidth
                sx={{ mt: 1 }}
              >
                Start Over
              </Button>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Complete Step */}
      {currentStep === 'complete' && importResults && (
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Import Complete!
              </Typography>
              
              <Box sx={{ my: 3 }}>
                <Typography variant="h6" color="success.main">
                  {importResults.imported} activities imported successfully
                </Typography>
                {importResults.failed > 0 && (
                  <Typography variant="body1" color="error.main">
                    {importResults.failed} activities failed to import
                  </Typography>
                )}
              </Box>

              <Button
                variant="contained"
                onClick={handleStartOver}
                sx={{ mt: 2 }}
              >
                Import More Notes
              </Button>
            </Paper>
          </Grid>
        </Grid>
      )}

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
                        setImportMethod('text');
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

// Activity Review Card Component
interface ActivityReviewCardProps {
  activity: ValidatedWorkActivity;
  onEdit: () => void;
  getConfidenceColor: (confidence: number) => 'success' | 'warning' | 'error';
}

const ActivityReviewCard: React.FC<ActivityReviewCardProps> = ({
  activity,
  onEdit,
  getConfidenceColor
}) => (
  <Card sx={{ border: activity.canImport ? '2px solid' : '2px solid', borderColor: activity.canImport ? 'success.main' : 'error.main' }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            {activity.clientName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Chip size="small" label={activity.date} icon={<ScheduleIcon />} />
            <Chip size="small" label={`${activity.totalHours}h`} color="primary" />
            <Chip 
              size="small" 
              label={`${Math.round(activity.confidence * 100)}%`} 
              color={getConfidenceColor(activity.confidence)} 
            />
            <Chip size="small" label={activity.workType} variant="outlined" />
          </Box>
        </Box>
        <IconButton onClick={onEdit} color="primary">
          <EditIcon />
        </IconButton>
      </Box>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        <strong>Time:</strong> {activity.startTime} - {activity.endTime} | <strong>Staff:</strong> {activity.employees.join(', ')}
      </Typography>

      {activity.tasks.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom><strong>Tasks:</strong></Typography>
          <List dense>
            {activity.tasks.map((task, index) => (
              <ListItem key={index} sx={{ py: 0 }}>
                <ListItemText primary={`• ${task}`} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {activity.charges && activity.charges.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom><strong>Charges:</strong></Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {activity.charges.map((charge, index) => (
              <Chip
                key={index}
                size="small"
                label={charge.description}
                icon={<MoneyIcon />}
                color="secondary"
              />
            ))}
          </Box>
        </Box>
      )}

      {activity.notes && (
        <Typography variant="body2" color="text.secondary">
          <strong>Notes:</strong> {activity.notes}
        </Typography>
      )}

      {activity.validationIssues.length > 0 && (
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" color="error">
              {activity.validationIssues.length} Validation Issue(s)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {activity.validationIssues.map((issue, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {issue.type === 'error' ? <ErrorIcon color="error" /> : <WarningIcon color="warning" />}
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
    </CardContent>
  </Card>
);

// Activity Edit Form Component
interface ActivityEditFormProps {
  activity: ValidatedWorkActivity;
  onChange: (activity: ValidatedWorkActivity) => void;
  onSave: () => void;
  onCancel: () => void;
}

const ActivityEditForm: React.FC<ActivityEditFormProps> = ({
  activity,
  onChange,
  onSave,
  onCancel
}) => {
  const updateField = (field: keyof ValidatedWorkActivity, value: any) => {
    onChange({ ...activity, [field]: value });
  };

  const updateTasks = (taskText: string) => {
    const tasks = taskText.split('\n').filter(task => task.trim());
    updateField('tasks', tasks);
  };

  return (
    <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon /> Edit Work Activity
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Client Name"
              value={activity.clientName}
              onChange={(e) => updateField('clientName', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={activity.date}
              onChange={(e) => updateField('date', e.target.value)}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Start Time"
              type="time"
              value={activity.startTime}
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
              value={activity.endTime}
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
              value={activity.totalHours}
              onChange={(e) => updateField('totalHours', parseFloat(e.target.value) || 0)}
              margin="normal"
              inputProps={{ step: 0.25, min: 0 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Work Type</InputLabel>
              <Select
                value={activity.workType}
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

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Employees (comma separated)"
              value={activity.employees.join(', ')}
              onChange={(e) => updateField('employees', e.target.value.split(',').map(emp => emp.trim()).filter(emp => emp))}
              margin="normal"
              helperText="e.g., Virginia, Rebecca, Anne"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Tasks"
              multiline
              rows={3}
              value={activity.tasks.join('\n')}
              onChange={(e) => updateTasks(e.target.value)}
              margin="normal"
              helperText="Enter each task on a new line"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              value={activity.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              margin="normal"
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                onClick={onSave}
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
      </CardContent>
    </Card>
  );
};

export default WorkNotesImport; 