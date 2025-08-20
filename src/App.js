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
  Alert
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [debugInfo, setDebugInfo] = useState('');
  
  useEffect(() => {
    checkAuthStatus();
    fetchEvents();
  }, []);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userId = urlParams.get('userId');
    
    if (token && userId) {
      console.log('🔑 OAuth callback received!');
      console.log('🔑 Token:', token.substring(0, 30) + '...');
      console.log('👤 User:', userId);
      
      setAccessToken(token);
      setUserEmail(userId);
      setIsAuthenticated(true);
      setDebugInfo(`Token: ${token.substring(0, 30)}... | User: ${userId}`);
      
      window.history.replaceState({}, document.title, window.location.pathname);
      syncFromGoogle(token, userId);
    }
  }, []);
  
  const checkAuthStatus = () => {
    const currentAuth = {
      isAuthenticated,
      hasToken: !!accessToken,
      userEmail,
      tokenLength: accessToken ? accessToken.length : 0
    };
    console.log('🔍 Current auth status:', currentAuth);
    setDebugInfo(`Auth: ${isAuthenticated} | Token: ${!!accessToken} | User: ${userEmail || 'None'}`);
  };
  
  const handleGoogleAuth = () => {
    console.log('🚀 Starting Google OAuth...');
    window.location.href = 'http://localhost:3000/auth/google';
  };
  
  const fetchEvents = async () => {
    try {
      const response = await axios.get('http://localhost:3000/events?userId=test');
      
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
      setLoading(false);
    } catch (error) {
      setLoading(false);
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
        console.log('🗑️ Deleting event...');
        console.log('🔑 Auth state:', { isAuthenticated, hasToken: !!accessToken, userEmail });
        
        let endpoint = `http://localhost:3000/events/${eventId}`;
        if (isAuthenticated && accessToken) {
          endpoint += `?accessToken=${encodeURIComponent(accessToken)}`;
          console.log('🔗 Delete URL with token:', endpoint.substring(0, 80) + '...');
        } else {
          console.log('🔗 Delete URL without token:', endpoint);
        }
        
        await axios.delete(endpoint);
        fetchEvents();
      } catch (error) {
        console.error('❌ Delete error:', error);
      }
    }
  };
  
  const saveEvent = async () => {
    try {
      if (!eventForm.title.trim()) {
        return;
      }
      
      console.log('💾 Saving event...');
      console.log('🔑 Auth state:', { isAuthenticated, hasToken: !!accessToken, userEmail });
      console.log('🔑 Token preview:', accessToken ? accessToken.substring(0, 30) + '...' : 'None');
      
      const [hours, minutes] = eventForm.time.split(':');
      const eventDateTime = new Date(selectedDate);
      eventDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const eventData = {
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        startDate: eventDateTime.toISOString(),
        endDate: new Date(eventDateTime.getTime() + 3600000).toISOString(),
        userId: 'test'
      };
      
      console.log('📤 Event data:', eventData);
      
      if (editingEvent) {
        // Update existing event
        let endpoint = `http://localhost:3000/events/${editingEvent.id}`;
        if (isAuthenticated && accessToken) {
          endpoint += `?accessToken=${encodeURIComponent(accessToken)}`;
          console.log('🔄 Update URL with token:', endpoint.substring(0, 80) + '...');
        } else {
          console.log('🔄 Update URL without token:', endpoint);
        }
        
        const response = await axios.put(endpoint, eventData);
        console.log('📥 Update response:', response.data);
      } else {
        // Create new event
        let endpoint = 'http://localhost:3000/events';
        if (isAuthenticated && accessToken) {
          endpoint += `?accessToken=${encodeURIComponent(accessToken)}`;
          console.log('➕ Create URL with token:', endpoint.substring(0, 80) + '...');
        } else {
          console.log('➕ Create URL without token:', endpoint);
        }
        
        const response = await axios.post(endpoint, eventData);
        console.log('📥 Create response:', response.data);
      }
      
      setDialogOpen(false);
      fetchEvents();
      
    } catch (error) {
      console.error('❌ Save error:', error);
    }
  };
  
  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    setEventForm({ title: '', description: '', time: '10:00' });
  };
  
  const syncFromGoogle = async (token, userId) => {
    try {
      console.log('🔄 Syncing from Google...');
      const syncUrl = `http://localhost:3000/events/sync?userId=${userId}&accessToken=${encodeURIComponent(token)}`;
      await axios.post(syncUrl);
      fetchEvents();
    } catch (error) {
      console.error('❌ Sync error:', error);
    }
  };
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (loading) {
    return <Box></Box>;
  }
  
  return (
      <Box sx={{ minHeight: '100vh', p: 2, backgroundColor: '#f5f5f5' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          {/* Debug Info */}
          <Alert severity="info" sx={{ mb: 2 }}>
            Debug: {debugInfo}
          </Alert>
          
          {!isAuthenticated && (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <Button
                    variant="contained"
                    onClick={handleGoogleAuth}
                    sx={{ backgroundColor: '#4285f4', color: 'white' }}
                >
                  🔗 Connect Google Calendar
                </Button>
              </Box>
          )}
          
          <Box sx={{ backgroundColor: 'white', borderRadius: 2, p: 3, boxShadow: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h2" fontWeight="bold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </Typography>
              {isAuthenticated && (
                  <Box sx={{ ml: 2, fontSize: 12, color: 'green' }}>
                    ✅ Synced with Google ({userEmail})
                  </Box>
              )}
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
                                      backgroundColor: '#667eea',
                                      color: 'white',
                                      p: 0.5,
                                      mb: 0.5,
                                      borderRadius: 1,
                                      fontSize: 11,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      '&:hover': {
                                        backgroundColor: '#5a67d8'
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
            {isAuthenticated && (
                <Typography variant="caption" color="green" display="block">
                  Will sync to Google Calendar
                </Typography>
            )}
          </DialogTitle>
          
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <TextField
                  label="Event Title"
                  fullWidth
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  autoFocus
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
            </Box>
          </DialogContent>
          
          <DialogActions>
            <Button onClick={handleDialogClose}>Cancel</Button>
            {editingEvent && (
                <Button onClick={() => handleEventDelete(editingEvent.id)} color="error">
                  Delete
                </Button>
            )}
            <Button onClick={saveEvent} variant="contained">
              {editingEvent ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
  );
}

export default App;