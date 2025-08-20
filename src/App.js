import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material';
import { Edit, Delete, Add, ChevronLeft, ChevronRight, Sync } from '@mui/icons-material';

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    time: '10:00'
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [webhookStatus, setWebhookStatus] = useState({ active: false, channels: 0 });
  
  useEffect(() => {
    initializeAuth();
    fetchEvents();
  }, []);
  
  useEffect(() => {
    let syncInterval;
    
    // Only use periodic sync if webhook is not active
    if (isAuthenticated && accessToken && userEmail && !webhookStatus.active) {
      syncInterval = setInterval(() => {
        syncFromGoogle(accessToken, userEmail, true); // Silent sync
      }, 60000); // Every 60 seconds
    }
    
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isAuthenticated, accessToken, userEmail, webhookStatus.active]);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userId = urlParams.get('userId');
    
    if (token && userId) {
      saveAuthToStorage(token, userId);
      setAccessToken(token);
      setUserEmail(userId);
      setIsAuthenticated(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Initial sync and webhook setup after auth
      setTimeout(async () => {
        await syncFromGoogle(token, userId, false);
        await setupWebhook(token, userId);
      }, 1000);
    }
  }, []);
  
  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };
  
  const saveAuthToStorage = (token, email) => {
    localStorage.setItem('calendar_access_token', token);
    localStorage.setItem('calendar_user_email', email);
    localStorage.setItem('calendar_auth_time', Date.now().toString());
  };
  
  const loadAuthFromStorage = () => {
    const token = localStorage.getItem('calendar_access_token');
    const email = localStorage.getItem('calendar_user_email');
    const authTime = localStorage.getItem('calendar_auth_time');
    
    if (token && email && authTime) {
      const timeDiff = Date.now() - parseInt(authTime);
      const oneHour = 60 * 60 * 1000;
      
      if (timeDiff < oneHour) {
        return { token, email };
      } else {
        clearAuthFromStorage();
      }
    }
    
    return null;
  };
  
  const clearAuthFromStorage = () => {
    localStorage.removeItem('calendar_access_token');
    localStorage.removeItem('calendar_user_email');
    localStorage.removeItem('calendar_auth_time');
  };
  
  const initializeAuth = () => {
    const savedAuth = loadAuthFromStorage();
    if (savedAuth) {
      setAccessToken(savedAuth.token);
      setUserEmail(savedAuth.email);
      setIsAuthenticated(true);
      // Check webhook status
      checkWebhookStatus(savedAuth.email);
    }
  };
  
  const handleGoogleAuth = () => {
    window.location.href = 'http://localhost:3000/auth/google';
  };
  
  const handleDisconnect = () => {
    clearAuthFromStorage();
    setAccessToken(null);
    setUserEmail(null);
    setIsAuthenticated(false);
    setWebhookStatus({ active: false, channels: 0 });
    showNotification('Disconnected from Google Calendar', 'info');
  };
  
  const setupWebhook = async (token, userId) => {
    try {
      showNotification('Setting up real-time sync...', 'info');
      
      // Use the actual user email for webhook setup
      const response = await axios.post(`http://localhost:3000/webhook/setup/${userId}?accessToken=${encodeURIComponent(token)}`);
      
      if (response.data.success) {
        showNotification('Real-time sync enabled! Changes in Google Calendar will now appear instantly.', 'success');
        setWebhookStatus({ active: true, channels: 1 });
      }
    } catch (error) {
      console.error('Webhook setup failed:', error);
      showNotification('Real-time sync setup failed. Using periodic sync instead.', 'warning');
    }
  };
  
  const checkWebhookStatus = async (userId) => {
    try {
      // Use the actual user email for webhook status check
      const response = await axios.get(`http://localhost:3000/webhook/status/${userId}`);
      
      if (response.data.success) {
        const activeChannels = response.data.channels.filter(ch => !ch.isExpired).length;
        setWebhookStatus({
          active: activeChannels > 0,
          channels: activeChannels
        });
      }
    } catch (error) {
      console.error('Failed to check webhook status:', error);
      setWebhookStatus({ active: false, channels: 0 });
    }
  };
  
  const fetchEvents = async () => {
    try {
      setLoading(true);
      // Use the actual user email instead of hardcoded "test"
      const userId = userEmail || 'test';
      const response = await axios.get(`http://localhost:3000/events?userId=${userId}`);
      
      const formattedEvents = response.data.data.map(event => {
        let startDate;
        if (event.startDate && event.startDate._seconds) {
          startDate = new Date(event.startDate._seconds * 1000);
        } else {
          startDate = new Date(event.startDate);
        }
        
        return {
          id: event.id,
          title: event.title,
          date: startDate.toDateString(),
          time: startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          description: event.description || '',
          fullDate: startDate,
          resource: event
        };
      });
      
      setEvents(formattedEvents);
    } catch (error) {
      showNotification('Failed to load events', 'error');
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const syncFromGoogle = async (token, userId, silent = false) => {
    try {
      if (!silent) {
        setSyncing(true);
        showNotification('Syncing with Google Calendar...', 'info');
      }
      
      await axios.post(`http://localhost:3000/events/sync?userId=${userId}&accessToken=${encodeURIComponent(token)}`);
      await fetchEvents();
      
      if (!silent) {
        showNotification('Successfully synced with Google Calendar', 'success');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthFromStorage();
        setIsAuthenticated(false);
        setAccessToken(null);
        setUserEmail(null);
        showNotification('Authentication expired. Please reconnect.', 'error');
      } else if (!silent) {
        showNotification('Failed to sync with Google Calendar', 'error');
      }
      console.error('Sync failed:', error);
    } finally {
      if (!silent) {
        setSyncing(false);
      }
    }
  };
  
  const refreshGoogleSync = async () => {
    if (isAuthenticated && accessToken && userEmail) {
      await syncFromGoogle(accessToken, userEmail, false);
    }
  };
  
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };
  
  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateString = date.toDateString();
    return events.filter(event => event.date === dateString);
  };
  
  const handleDateClick = (date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setEventForm({
      title: '',
      description: '',
      time: '10:00'
    });
    setDialogOpen(true);
  };
  
  const handleEventEdit = (event) => {
    setEditingEvent(event);
    setSelectedDate(event.fullDate);
    setEventForm({
      title: event.title,
      description: event.description,
      time: event.time
    });
    setDialogOpen(true);
  };
  
  const handleEventDelete = async (eventId) => {
    if (window.confirm('Delete this event?')) {
      try {
        let endpoint = `http://localhost:3000/events/${eventId}`;
        if (isAuthenticated && accessToken) {
          endpoint += `?accessToken=${encodeURIComponent(accessToken)}`;
        }
        
        await axios.delete(endpoint);
        showNotification('Event deleted successfully', 'success');
        await fetchEvents();
      } catch (error) {
        if (error.response?.status === 401) {
          clearAuthFromStorage();
          setIsAuthenticated(false);
          showNotification('Authentication expired. Please reconnect.', 'error');
        } else {
          showNotification('Failed to delete event', 'error');
        }
        console.error('Delete failed:', error);
      }
    }
  };
  
  const saveEvent = async () => {
    try {
      if (!eventForm.title.trim()) {
        showNotification('Event title is required', 'warning');
        return;
      }
      
      const [hours, minutes] = eventForm.time.split(':');
      const eventDateTime = new Date(selectedDate);
      eventDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const eventData = {
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        startDate: eventDateTime.toISOString(),
        endDate: new Date(eventDateTime.getTime() + 3600000).toISOString(),
        userId: userEmail || 'test'
      };
      
      if (editingEvent) {
        let endpoint = `http://localhost:3000/events/${editingEvent.id}`;
        if (isAuthenticated && accessToken) {
          endpoint += `?accessToken=${encodeURIComponent(accessToken)}`;
        }
        
        await axios.put(endpoint, eventData);
        showNotification('Event updated successfully', 'success');
      } else {
        let endpoint = 'http://localhost:3000/events';
        if (isAuthenticated && accessToken) {
          endpoint += `?accessToken=${encodeURIComponent(accessToken)}`;
        }
        
        await axios.post(endpoint, eventData);
        showNotification('Event created successfully', 'success');
      }
      
      setDialogOpen(false);
      await fetchEvents();
      
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthFromStorage();
        setIsAuthenticated(false);
        showNotification('Authentication expired. Please reconnect.', 'error');
      } else {
        showNotification('Failed to save event', 'error');
      }
      console.error('Save failed:', error);
    }
  };
  
  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    setEventForm({ title: '', description: '', time: '10:00' });
  };
  
  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (loading) {
    return (
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh'
        }}>
          <CircularProgress />
        </Box>
    );
  }
  
  return (
      <Box sx={{ minHeight: '100vh', p: 2, backgroundColor: '#f5f5f5' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          {!isAuthenticated ? (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <Button
                    variant="contained"
                    onClick={handleGoogleAuth}
                    sx={{ backgroundColor: '#4285f4', color: 'white' }}
                >
                  Connect Google Calendar
                </Button>
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                  Connect to sync events with Google Calendar
                </Typography>
              </Box>
          ) : (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Button
                    variant="outlined"
                    onClick={refreshGoogleSync}
                    disabled={syncing}
                    startIcon={syncing ? <CircularProgress size={16} /> : <Sync />}
                    size="small"
                >
                  {syncing ? 'Syncing...' : 'Manual Sync'}
                </Button>
                <Button
                    variant="outlined"
                    onClick={() => setupWebhook(accessToken, userEmail)}
                    disabled={syncing || webhookStatus.active}
                    size="small"
                >
                  {webhookStatus.active ? 'Real-time Active ✓' : 'Enable Real-time Sync'}
                </Button>
                <Button
                    variant="outlined"
                    onClick={handleDisconnect}
                    color="error"
                    size="small"
                >
                  Disconnect Google
                </Button>
                <Typography variant="caption" sx={{
                  display: 'flex',
                  alignItems: 'center',
                  color: 'text.secondary',
                  ml: 1
                }}>
                  Connected as: {userEmail}
                </Typography>
              </Box>
          )}
          
          <Box sx={{ backgroundColor: 'white', borderRadius: 2, p: 3, boxShadow: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <IconButton
                  onClick={() => navigateMonth(-1)}
                  sx={{ color: '#1976d2' }}
              >
                <ChevronLeft />
              </IconButton>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Typography variant="h4" component="h2" fontWeight="bold">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </Typography>
                {isAuthenticated && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: webhookStatus.active ? 'green' : (syncing ? 'orange' : 'gray'),
                        animation: syncing ? 'pulse 2s infinite' : 'none'
                      }} />
                      <Typography variant="caption" sx={{
                        color: webhookStatus.active ? 'green' : (syncing ? 'orange' : 'gray'),
                        fontSize: 12
                      }}>
                        {webhookStatus.active ? 'Real-time Sync Active' : (syncing ? 'Syncing...' : 'Manual Sync Only')}
                      </Typography>
                    </Box>
                )}
              </Box>
              
              <IconButton
                  onClick={() => navigateMonth(1)}
                  sx={{ color: '#1976d2' }}
              >
                <ChevronRight />
              </IconButton>
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
              {dayNames.map(day => (
                  <Box key={day} sx={{
                    p: 1,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    borderRadius: 1
                  }}>
                    {day}
                  </Box>
              ))}
              
              {generateCalendarDays().map((date, index) => {
                const dayEvents = date ? getEventsForDate(date) : [];
                const isToday = date && date.toDateString() === new Date().toDateString();
                
                return (
                    <Box
                        key={index}
                        sx={{
                          minHeight: 120,
                          p: 1,
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          backgroundColor: date ? (isToday ? '#fff3cd' : 'white') : '#f5f5f5',
                          cursor: date ? 'pointer' : 'default',
                          '&:hover': {
                            backgroundColor: date ? (isToday ? '#ffeaa7' : '#f0f0f0') : '#f5f5f5'
                          }
                        }}
                        onClick={() => date && handleDateClick(date)}
                    >
                      {date && (
                          <>
                            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                              {date.getDate()}
                            </Typography>
                            
                            {dayEvents.map(event => (
                                <Box
                                    key={event.id}
                                    sx={{
                                      backgroundColor: event.resource?.googleCalendarId ? '#4285f4' : '#667eea',
                                      color: 'white',
                                      p: 0.5,
                                      mb: 0.5,
                                      borderRadius: 1,
                                      fontSize: 11,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      '&:hover': {
                                        backgroundColor: event.resource?.googleCalendarId ? '#3367d6' : '#5a67d8'
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                  <Box sx={{ flex: 1, overflow: 'hidden' }}>
                                    <Typography variant="caption" sx={{
                                      display: 'block',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      {event.time} {event.title}
                                      {event.resource?.googleCalendarId && (
                                          <span style={{ opacity: 0.7 }}> 📅</span>
                                      )}
                                    </Typography>
                                  </Box>
                                  
                                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <IconButton
                                        size="small"
                                        sx={{ color: 'white', p: 0.2 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEventEdit(event);
                                        }}
                                    >
                                      <Edit sx={{ fontSize: 12 }} />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        sx={{ color: 'white', p: 0.2 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEventDelete(event.id);
                                        }}
                                    >
                                      <Delete sx={{ fontSize: 12 }} />
                                    </IconButton>
                                  </Box>
                                </Box>
                            ))}
                            
                            {dayEvents.length === 0 && (
                                <Box sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  height: '80px',
                                  opacity: 0.3,
                                  '&:hover': { opacity: 0.7 }
                                }}>
                                  <Add sx={{ fontSize: 20, color: '#666' }} />
                                </Box>
                            )}
                          </>
                      )}
                    </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
        
        <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingEvent ? 'Edit Event' : 'Add Event'} - {selectedDate?.toDateString()}
          </DialogTitle>
          
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <TextField
                  label="Event Title"
                  fullWidth
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  autoFocus
                  required
              />
              
              <TextField
                  label="Time"
                  type="time"
                  value={eventForm.time}
                  onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                  InputLabelProps={{ shrink: true }}
              />
              
              <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
              />
              
              {editingEvent?.resource?.googleCalendarId && (
                  <Box sx={{
                    p: 1,
                    backgroundColor: '#e3f2fd',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <Typography variant="caption" color="primary">
                      📅 This event is synced with Google Calendar
                    </Typography>
                  </Box>
              )}
            </Box>
          </DialogContent>
          
          <DialogActions>
            <Button onClick={handleDialogClose}>Cancel</Button>
            {editingEvent && (
                <Button onClick={() => handleEventDelete(editingEvent.id)} color="error">
                  Delete
                </Button>
            )}
            <Button onClick={saveEvent} variant="contained" disabled={!eventForm.title.trim()}>
              {editingEvent ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
        
        <Snackbar
            open={notification.open}
            autoHideDuration={4000}
            onClose={() => setNotification({ ...notification, open: false })}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setNotification({ ...notification, open: false })} severity={notification.severity}>
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
  );
}

export default App;