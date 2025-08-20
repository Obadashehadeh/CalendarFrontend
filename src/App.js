import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import axios from 'axios';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './App.css';

const localizer = momentLocalizer(moment);

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch events from your backend
  useEffect(() => {
    fetchEvents();
  }, []);
  
  const fetchEvents = async () => {
    try {
      const response = await axios.get('http://localhost:3000/events?userId=test');
      
      // Convert Firebase timestamps to JavaScript Dates
      const formattedEvents = response.data.data.map(event => ({
        id: event.id,
        title: event.title,
        start: new Date(event.startDate._seconds * 1000),
        end: new Date(event.endDate._seconds * 1000),
        resource: event
      }));
      
      setEvents(formattedEvents);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching events:', error);
      setLoading(false);
    }
  };
  
  const handleSelectSlot = ({ start, end }) => {
    const title = window.prompt('New Event Title:');
    if (title) {
      createEvent(title, start, end);
    }
  };
  
  const createEvent = async (title, start, end) => {
    try {
      const newEvent = {
        title,
        description: '',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        userId: 'test'
      };
      
      await axios.post('http://localhost:3000/events', newEvent);
      fetchEvents(); // Refresh events
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };
  
  if (loading) {
    return <div>Loading your calendar...</div>;
  }
  
  return (
      <div className="App">
        <header className="App-header">
          <h1>My Calendar App</h1>
          <p>Events: {events.length} | Backend: ✅ Connected</p>
        </header>
        
        <div style={{ height: '600px', margin: '20px' }}>
          <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              onSelectSlot={handleSelectSlot}
              selectable
              style={{ height: '100%' }}
          />
        </div>
      </div>
  );
}

export default App;