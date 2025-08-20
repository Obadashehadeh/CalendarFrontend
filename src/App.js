import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
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
  Alert,
  Chip
} from '@mui/material';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './App.css';

const localizer = momentLocalizer(moment);

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Google Calendar integration states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  
  // Fetch events from backend
  useEffect(() => {
    fetchEvents();
  }, []);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userId = urlParams.get('userId');
    
    if (token && userId) {
      setAccessToken(token);
      setUserEmail(userId);
      setIsAuthenticated(true);
      setSuccess('✅ Connected to Google Calendar!');
      
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const syncFromGoogle = async (token, userId) => {
        try {
          await axios.post(`http://localhost:3000/events/sync?userId=${userId}&accessToken=${token}`);
          setSuccess('✅ Synced events from Google Calendar!');
          fetchEvents();
        } catch (error) {
          console.error('Sync error:', error);
          setError('Failed to sync from Google Calendar');
        }
      };
      
      syncFromGoogle(token, userId);
    }
  }, []);
  
  const fetchEvents = async () => {
    try {
      setError('');
      const response = await axios.get('http://localhost:3000/events?userId=test');
      
      const formattedEvents = response.data.data.map(event => ({
        id: event.id,
        title: event.title,
        start: new Date(event.startDate._seconds * 1000),
        end: new Date(event.endDate._seconds * 1000),
        resource: event
      }));
      
      setEvents(formattedEvents);
      setLoading(false);
      setSuccess(`Loaded ${formattedEvents.length} events successfully!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to load events. Make sure backend is running on port 3000.');
      setLoading(false);
    }
  };
  
  const handleSelectSlot = ({ start, end }) => {
    setEventForm({
      title: '',
      description: '',
      startDate: start.toISOString().slice(0, 16),
      endDate: end.toISOString().slice(0, 16)
    });
    setDialogOpen(true);
  };
  
  const handleSelectEvent = (event) => {
    if (window.confirm(`Delete event: "${event.title}"?`)) {
      deleteEvent(event.id);
    }
  };
  
  const createEvent = async () => {
    try {
      setError('');
      
      if (!eventForm.title.trim()) {
        setError('Event title is required');
        return;
      }
      
      const newEvent = {
        title: eventForm.title,
        description: eventForm.description,
        startDate: new Date(eventForm.startDate).toISOString(),
        endDate: new Date(eventForm.endDate).toISOString(),
        userId: 'test'
      };
      
      // Create event with Google sync if authenticated
      const endpoint = isAuthenticated
          ? `http://localhost:3000/events?accessToken=${accessToken}`
          : 'http://localhost:3000/events';
      
      await axios.post(endpoint, newEvent);
      setDialogOpen(false);
      setSuccess(isAuthenticated
          ? 'Event created and synced to Google Calendar!'
          : 'Event created successfully!'
      );
      setTimeout(() => setSuccess(''), 3000);
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event');
    }
  };
  
  const deleteEvent = async (eventId) => {
    try {
      setError('');
      const endpoint = isAuthenticated
          ? `http://localhost:3000/events/${eventId}?accessToken=${accessToken}`
          : `http://localhost:3000/events/${eventId}`;
      
      await axios.delete(endpoint);
      setSuccess('Event deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event');
    }
  };
  
  const handleDialogClose = () => {
    setDialogOpen(false);
    setEventForm({ title: '', description: '', startDate: '', endDate: '' });
    setError('');
  };
  
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/auth/google';
  };
  
  const handleDemoMode = () => {
    setIsAuthenticated(true);
    setUserEmail('demo@example.com');
    setAccessToken('demo-token');
    setSuccess('✅ Demo mode activated - events save to Firebase only');
    setTimeout(() => setSuccess(''), 3000);
  };
  
  const syncFromGoogle = async (token, userId) => {
    try {
      await axios.post(`http://localhost:3000/events/sync?userId=${userId}&accessToken=${token}`);
      setSuccess('✅ Synced events from Google Calendar!');
      fetchEvents();
    } catch (error) {
      console.error('Sync error:', error);
      setError('Failed to sync from Google Calendar');
    }
  };
  
  if (loading) {
    return (
        <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
          <Typography variant="h5">Loading your calendar...</Typography>
        </Box>
    );
  }
  
  return (
      <div className="App">
        <Box sx={{ backgroundColor: '#1976d2', color: 'white', p: 3, mb: 2 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            📅 My Calendar App
          </Typography>
          <Box display="flex" gap={2} alignItems="center" justifyContent="center" flexWrap="wrap">
            <Chip label={`${events.length} Events`} color="secondary" />
            <Chip label="Backend Connected ✅" color="success" />
            
            {!isAuthenticated ? (
                <Box display="flex" gap={1}>
                  <Button
                      variant="contained"
                      color="warning"
                      onClick={handleGoogleLogin}
                      startIcon={<span>🔗</span>}
                      size="small"
                  >
                    Real Google Calendar
                  </Button>
                  <Button
                      variant="outlined"
                      color="secondary"
                      onClick={handleDemoMode}
                      size="small"
                      sx={{ color: 'white', borderColor: 'white' }}
                  >
                    Demo Mode
                  </Button>
                </Box>
            ) : (
                <Chip
                    label={`Google Calendar ✅ ${userEmail}`}
                    color="success"
                    variant="outlined"
                    sx={{ color: 'white', borderColor: 'white' }}
                />
            )}
            
            <Button
                variant="contained"
                color="secondary"
                onClick={fetchEvents}
                size="small"
            >
              Refresh
            </Button>
          </Box>
        </Box>
        
        {error && (
            <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
              {error}
            </Alert>
        )}
        
        {success && (
            <Alert severity="success" sx={{ mx: 2, mb: 2 }}>
              {success}
            </Alert>
        )}
        
        <Box sx={{ mx: 2, mb: 2 }}>
          <Typography variant="body1" color="text.secondary">
            💡 Click on empty time slots to create events • Click on events to delete them
          </Typography>
        </Box>
        
        <Box sx={{ height: '70vh', mx: 2 }}>
          <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              selectable
              style={{ height: '100%' }}
              views={['month', 'week', 'day']}
              defaultView='month'
          />
        </Box>
        
        {/* Create Event Dialog */}
        <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ backgroundColor: '#1976d2', color: 'white' }}>
            Create New Event
          </DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <TextField
                  label="Event Title"
                  fullWidth
                  required
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  error={error.includes('title')}
              />
              
              <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
              />
              
              <TextField
                  label="Start Date & Time"
                  type="datetime-local"
                  fullWidth
                  value={eventForm.startDate}
                  onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
              />
              
              <TextField
                  label="End Date & Time"
                  type="datetime-local"
                  fullWidth
                  value={eventForm.endDate}
                  onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
              />
              
              {isAuthenticated && (
                  <Alert severity="info">
                    Event will be synced to {userEmail === 'demo@example.com' ? 'Demo Mode (Firebase only)' : 'Google Calendar'}
                  </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose}>Cancel</Button>
            <Button onClick={createEvent} variant="contained">
              Create Event
            </Button>
          </DialogActions>
        </Dialog>
      </div>
  );
}

export default App;