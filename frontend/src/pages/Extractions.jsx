import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  LinearProgress,
  Alert,
  Fab,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import axios from '../utils/axios';

const extractionTypes = [
  { value: 'unified_audit_log', label: 'Unified Audit Log', description: 'Microsoft 365 audit events' },
  { value: 'azure_signin_logs', label: 'Azure Sign-in Logs', description: 'Azure AD authentication events' },
  { value: 'azure_audit_logs', label: 'Azure Audit Logs', description: 'Azure AD configuration changes' },
  { value: 'mfa_status', label: 'MFA Status', description: 'Multi-factor authentication configuration' },
  { value: 'oauth_permissions', label: 'OAuth Permissions', description: 'Application permissions and consents' },
  { value: 'risky_users', label: 'Risky Users', description: 'Azure AD risky user detections' },
  { value: 'risky_detections', label: 'Risky Detections', description: 'Azure AD risk events' },
  { value: 'mailbox_audit', label: 'Mailbox Audit', description: 'Exchange Online mailbox activity' },
  { value: 'message_trace', label: 'Message Trace', description: 'Email message tracking' },
  { value: 'devices', label: 'Devices', description: 'Device registration and compliance' },
  { value: 'full_extraction', label: 'Full Extraction', description: 'Complete evidence collection' }
];

const statusColors = {
  pending: 'warning',
  running: 'info',
  completed: 'success',
  failed: 'error',
  cancelled: 'default'
};

const Extractions = () => {
  const [extractions, setExtractions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExtraction, setSelectedExtraction] = useState(null);
  const [progressData, setProgressData] = useState({});
  const { control, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      type: 'unified_audit_log',
      startDate: dayjs().subtract(7, 'days'),
      endDate: dayjs(),
      priority: 'medium',
      includeDeleted: false,
      filterUsers: '',
      filterOperations: '',
      customFilters: ''
    }
  });
  const { enqueueSnackbar } = useSnackbar();

  const selectedType = watch('type');

  const fetchExtractions = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/extractions');
      setExtractions(response.data.extractions);
      
      // Fetch progress for running extractions
      const runningExtractions = response.data.extractions.filter(e => e.status === 'running');
      await fetchProgressForExtractions(runningExtractions);
    } catch (error) {
      enqueueSnackbar('Failed to fetch extractions', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProgressForExtractions = async (runningExtractions) => {
    try {
      const progressPromises = runningExtractions.map(async (extraction) => {
        try {
          const response = await axios.get(`/api/extractions/${extraction.id}/progress`);
          return { id: extraction.id, progress: response.data.progress };
        } catch (error) {
          return { id: extraction.id, progress: null };
        }
      });
      
      const progressResults = await Promise.all(progressPromises);
      const newProgressData = {};
      progressResults.forEach(result => {
        if (result.progress) {
          newProgressData[result.id] = result.progress;
        }
      });
      
      setProgressData(prev => ({ ...prev, ...newProgressData }));
    } catch (error) {
      console.error('Failed to fetch progress data:', error);
    }
  };

  useEffect(() => {
    fetchExtractions();
    const interval = setInterval(fetchExtractions, 15000); // Refresh every 15 seconds (further reduced frequency)
    return () => clearInterval(interval);
  }, []);

  const onSubmit = async (data) => {
    try {
      const payload = {
        type: data.type,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        priority: data.priority,
        parameters: {
          includeDeleted: data.includeDeleted,
          filterUsers: data.filterUsers ? data.filterUsers.split(',').map(u => u.trim()) : [],
          filterOperations: data.filterOperations ? data.filterOperations.split(',').map(o => o.trim()) : [],
          customFilters: data.customFilters ? JSON.parse(data.customFilters) : {}
        }
      };

      await axios.post('/api/extractions', payload);
      enqueueSnackbar('Extraction job created successfully', { variant: 'success' });
      setDialogOpen(false);
      reset();
      fetchExtractions();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.error || 'Failed to create extraction', { variant: 'error' });
    }
  };

  const cancelExtraction = async (id) => {
    try {
      await axios.post(`/api/extractions/${id}/cancel`);
      enqueueSnackbar('Extraction cancelled', { variant: 'success' });
      fetchExtractions();
    } catch (error) {
      enqueueSnackbar('Failed to cancel extraction', { variant: 'error' });
    }
  };

  const viewLogs = async (id) => {
    try {
      const response = await axios.get(`/api/extractions/${id}/logs`);
      setSelectedExtraction({ id, logs: response.data.logs });
    } catch (error) {
      enqueueSnackbar('Failed to fetch logs', { variant: 'error' });
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const renderUalStatus = (ualStatus) => {
    if (!ualStatus) return null;
    
    const statusConfig = {
      enabled: { 
        icon: <CheckCircleIcon sx={{ color: 'success.main', fontSize: 16 }} />,
        tooltip: 'Unified Audit Log is enabled',
        color: 'success'
      },
      disabled: { 
        icon: <WarningIcon sx={{ color: 'warning.main', fontSize: 16 }} />,
        tooltip: 'Unified Audit Log is disabled - extraction may fail',
        color: 'warning'
      },
      error: { 
        icon: <ErrorIcon sx={{ color: 'error.main', fontSize: 16 }} />,
        tooltip: 'Unable to verify Unified Audit Log status',
        color: 'error'
      }
    };
    
    const config = statusConfig[ualStatus];
    if (!config) return null;
    
    return (
      <Tooltip title={config.tooltip}>
        {config.icon}
      </Tooltip>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Data Extractions</Typography>
          <Box>
            <IconButton onClick={fetchExtractions} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <Fab 
              color="primary" 
              sx={{ ml: 1 }}
              onClick={() => setDialogOpen(true)}
            >
              <AddIcon />
            </Fab>
          </Box>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* UAL Status Alerts */}
        {extractions.some(e => progressData[e.id]?.ualStatus === 'disabled' && ['unified_audit_log', 'full_extraction'].includes(e.type)) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Unified Audit Log Disabled:</strong> Some extractions require Unified Audit Log to be enabled in your Microsoft 365 organization. 
              Please enable auditing in the Microsoft 365 compliance center to access audit logs.
            </Typography>
          </Alert>
        )}
        
        {extractions.some(e => progressData[e.id]?.ualStatus === 'error' && ['unified_audit_log', 'full_extraction'].includes(e.type)) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Unable to Verify Audit Status:</strong> Could not check if Unified Audit Log is enabled. 
              Please ensure your application has the necessary permissions to access audit configuration.
            </Typography>
          </Alert>
        )}

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary">
                  {extractions.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Extractions
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="info.main">
                  {extractions.filter(e => e.status === 'running').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Running
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main">
                  {extractions.filter(e => e.status === 'completed').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="error.main">
                  {extractions.filter(e => e.status === 'failed').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Failed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Extractions Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Date Range</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {extractions.map((extraction) => (
                <TableRow key={extraction.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {extractionTypes.find(t => t.value === extraction.type)?.label || extraction.type}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Priority: {extraction.priority}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {dayjs(extraction.startDate).format('MMM DD, YYYY')}
                    </Typography>
                    <Typography variant="body2">
                      to {dayjs(extraction.endDate).format('MMM DD, YYYY')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={extraction.status} 
                      color={statusColors[extraction.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ width: 100 }}>
                      {(() => {
                        const progress = progressData[extraction.id] ? progressData[extraction.id].progress : (extraction.progress || 0);
                        const currentMessage = progressData[extraction.id] ? progressData[extraction.id].currentMessage : '';
                        const ualStatus = progressData[extraction.id] ? progressData[extraction.id].ualStatus : null;
                        
                        return (
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={progress}
                                sx={{ flex: 1 }}
                              />
                              {ualStatus && ['unified_audit_log', 'full_extraction'].includes(extraction.type) && (
                                renderUalStatus(ualStatus)
                              )}
                            </Box>
                            <Typography variant="caption">
                              {progress}%
                            </Typography>
                            {currentMessage && extraction.status === 'running' && (
                              <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.7rem', mt: 0.5 }}>
                                {currentMessage.length > 30 ? currentMessage.substring(0, 30) + '...' : currentMessage}
                              </Typography>
                            )}
                          </Box>
                        );
                      })()}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {extraction.itemsExtracted?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell>
                    {formatDuration(extraction.duration)}
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      onClick={() => viewLogs(extraction.id)}
                      title="View Logs"
                    >
                      <ViewIcon />
                    </IconButton>
                    {['pending', 'running'].includes(extraction.status) && (
                      <IconButton 
                        size="small" 
                        onClick={() => cancelExtraction(extraction.id)}
                        title="Cancel"
                      >
                        <StopIcon />
                      </IconButton>
                    )}
                    {extraction.status === 'completed' && extraction.outputFiles?.length > 0 && (
                      <IconButton 
                        size="small" 
                        title="Download Results"
                      >
                        <DownloadIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {extractions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No extractions found. Create your first extraction to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Create Extraction Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogTitle>Create New Extraction</DialogTitle>
            <DialogContent>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                {/* Extraction Type */}
                <Grid item xs={12}>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Extraction Type</InputLabel>
                        <Select {...field} label="Extraction Type">
                          {extractionTypes.map((type) => (
                            <MenuItem key={type.value} value={type.value}>
                              <Box>
                                <Typography variant="body1">{type.label}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {type.description}
                                </Typography>
                                {['unified_audit_log', 'full_extraction'].includes(type.value) && (
                                  <Typography variant="caption" color="warning.main" display="block">
                                    ⚠️ Requires Unified Audit Log to be enabled
                                  </Typography>
                                )}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>

                {/* Date Range */}
                <Grid item xs={12} md={6}>
                  <Controller
                    name="startDate"
                    control={control}
                    render={({ field }) => (
                      <DateTimePicker
                        {...field}
                        label="Start Date"
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="endDate"
                    control={control}
                    render={({ field }) => (
                      <DateTimePicker
                        {...field}
                        label="End Date"
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    )}
                  />
                </Grid>

                {/* Priority */}
                <Grid item xs={12} md={6}>
                  <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Priority</InputLabel>
                        <Select {...field} label="Priority">
                          <MenuItem value="low">Low</MenuItem>
                          <MenuItem value="medium">Medium</MenuItem>
                          <MenuItem value="high">High</MenuItem>
                          <MenuItem value="critical">Critical</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>

                {/* Advanced Options */}
                <Grid item xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Advanced Options</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Controller
                            name="includeDeleted"
                            control={control}
                            render={({ field }) => (
                              <FormControlLabel
                                control={<Switch {...field} checked={field.value} />}
                                label="Include deleted items"
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Controller
                            name="filterUsers"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                label="Filter Users"
                                placeholder="user1@domain.com, user2@domain.com"
                                helperText="Comma-separated list of users to include"
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Controller
                            name="filterOperations"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                label="Filter Operations"
                                placeholder="FileAccessed, UserLoggedIn"
                                helperText="Comma-separated list of operations"
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Controller
                            name="customFilters"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                multiline
                                rows={3}
                                label="Custom Filters (JSON)"
                                placeholder='{"ClientIP": "192.168.1.0/24"}'
                                helperText="Advanced JSON-based filters"
                              />
                            )}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained">Create Extraction</Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Logs Dialog */}
        {selectedExtraction && (
          <Dialog 
            open={Boolean(selectedExtraction)} 
            onClose={() => setSelectedExtraction(null)}
            maxWidth="md" 
            fullWidth
          >
            <DialogTitle>Extraction Logs</DialogTitle>
            <DialogContent>
              <Box 
                sx={{ 
                  bgcolor: '#1e1e1e', 
                  color: '#d4d4d4',
                  p: 2, 
                  borderRadius: 1, 
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  maxHeight: '500px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {selectedExtraction.logs?.length > 0 ? (
                  selectedExtraction.logs.map((log, index) => {
                    let color = '#d4d4d4';
                    let icon = '';
                    
                    switch(log.level) {
                      case 'error':
                        color = '#f48771';
                        icon = '✗';
                        break;
                      case 'warn':
                        color = '#dcdcaa';
                        icon = '⚠';
                        break;
                      case 'success':
                        color = '#4fc1ff';
                        icon = '✓';
                        break;
                      case 'info':
                      default:
                        color = '#9cdcfe';
                        icon = 'ℹ';
                        break;
                    }
                    
                    return (
                      <Box key={index} sx={{ mb: 0.5 }}>
                        <span style={{ color: '#608b4e' }}>
                          [{dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss')}]
                        </span>
                        {' '}
                        <span style={{ color, fontWeight: 'bold' }}>
                          {icon} {log.level.toUpperCase()}:
                        </span>
                        {' '}
                        <span style={{ color: '#d4d4d4' }}>
                          {log.message}
                        </span>
                      </Box>
                    );
                  })
                ) : (
                  <Typography sx={{ color: '#808080', fontStyle: 'italic' }}>
                    No logs available yet. Logs will appear here once the extraction starts processing.
                  </Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedExtraction(null)}>Close</Button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default Extractions;