import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Event {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  attendees_count?: number;
  user_status?: 'attending' | 'maybe' | 'not_attending';
}

interface EventsState {
  events: Event[];
  currentEvent: Event | null;
  loading: boolean;
  error: string | null;
}

const initialState: EventsState = {
  events: [],
  currentEvent: null,
  loading: false,
  error: null,
};

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    setEvents: (state, action: PayloadAction<Event[]>) => {
      state.events = action.payload;
      state.loading = false;
      state.error = null;
    },
    addEvent: (state, action: PayloadAction<Event>) => {
      state.events.push(action.payload);
    },
    updateEvent: (state, action: PayloadAction<Event>) => {
      const index = state.events.findIndex(e => e.id === action.payload.id);
      if (index !== -1) {
        state.events[index] = action.payload;
      }
    },
    deleteEvent: (state, action: PayloadAction<string>) => {
      state.events = state.events.filter(e => e.id !== action.payload);
    },
    setCurrentEvent: (state, action: PayloadAction<Event | null>) => {
      state.currentEvent = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const {
  setEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  setCurrentEvent,
  setLoading,
  setError,
} = eventsSlice.actions;

export default eventsSlice.reducer; 