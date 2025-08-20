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
  IconButton
} from '@mui/material';
import { Edit, Delete, Add, ChevronLeft, ChevronRight } from '@mui/icons-material';

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
  
  useEffect(() => {
    initializeAuth();
    fetchEvents();
  }, []);
  
  useEffect(() => {
    let syncInterval;
    
    if (isAuthenticated && accessToken && userEmail) {
      syncInterval = setInterval(() => {
        syncFromGoogle(accessToken, userEmail);
      }, 30000); // Sync every 30 seconds
    }
    
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isAuthenticated, accessToken, userEmail]);
  
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
      syncFromGoogle(token, userId);
    }
  }, []);
  
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
  
  const syncFromGoogle = async (token, userId) => {
    try {
      await axios.post(`http://localhost:3000/events/sync?userId=${userId}&accessToken=${encodeURIComponent(token)}`);
      await fetchEvents();
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthFromStorage();
        setIsAuthenticated(false);
        setAccessToken(null);
        setUserEmail(null);
      }
    }
  };
  
  const refreshGoogleSync = async () => {
    if (isAuthenticated && accessToken && userEmail) {
      await syncFromGoogle(accessToken, userEmail);
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
        fetchEvents();
      } catch (error) {
        if (error.response?.status === 401) {
          clearAuthFromStorage();
          setIsAuthenticated(false);
        }
      }
    }
  };
  
  const saveEvent = async () => {
    try {
      if (!eventForm.title.trim()) {
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
        userId: 'test'
      };
      
      if (editingEvent) {
        let endpoint = `http://localhost:3000/events/${editingEvent.id}`;
        if (isAuthenticated && accessToken) {
          endpoint += `?accessToken=${encodeURIComponent(accessToken)}`;
        }
        
        await axios.put(endpoint, eventData);
      } else {
        let endpoint = 'http://localhost:3000/events';
        if (isAuthenticated && accessToken) {
          endpoint += `?accessToken=${encodeURIComponent(accessToken)}`;
        }
        
        await axios.post(endpoint, eventData);
      }
      
      setDialogOpen(false);
      fetchEvents();
      
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthFromStorage();
        setIsAuthenticated(false);
      }
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
    return <Box></Box>;
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
              </Box>
          ) : (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button
                    variant="outlined"
                    onClick={refreshGoogleSync}
                    size="small"
                >
                  Sync from Google
                </Button>
                <Button
                    variant="outlined"
                    onClick={handleDisconnect}
                    color="error"
                    size="small"
                >
                  Disconnect
                </Button>
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
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h4" component="h2" fontWeight="bold">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </Typography>
                {isAuthenticated && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: 'green',
                        animation: 'pulse 2s infinite'
                      }} />
                      <Typography variant="caption" sx={{ color: 'green', fontSize: 12 }}>
                        Auto-Sync
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