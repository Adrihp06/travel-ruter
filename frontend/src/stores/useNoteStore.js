import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const useNoteStore = create((set, get) => ({
  notes: [],
  groupedNotes: null, // { trip_level: [], pinned: [], by_destination: [], total_count: 0 }
  notesByDay: null, // { general: [], by_day: {}, total_count: 0 }
  selectedNote: null,
  noteStats: null,
  isLoading: false,
  isUploading: false,
  error: null,
  searchResults: null,

  // Setters
  setNotes: (notes) => set({ notes }),
  selectNote: (noteId) => set((state) => ({
    selectedNote: state.notes.find((n) => n.id === noteId) || null
  })),
  clearSelectedNote: () => set({ selectedNote: null }),
  clearError: () => set({ error: null }),
  clearSearchResults: () => set({ searchResults: null }),

  // Fetch notes for a trip
  fetchTripNotes: async (tripId, filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters.destination_id) params.append('destination_id', filters.destination_id);
      if (filters.day_number) params.append('day_number', filters.day_number);
      if (filters.poi_id) params.append('poi_id', filters.poi_id);
      if (filters.note_type) params.append('note_type', filters.note_type);
      if (filters.is_pinned !== undefined) params.append('is_pinned', filters.is_pinned);

      const queryString = params.toString();
      const url = `${API_BASE_URL}/trips/${tripId}/notes${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      const data = await response.json();
      set({ notes: data.notes, isLoading: false });
      return data.notes;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  // Fetch notes grouped by destination
  fetchTripNotesGrouped: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/notes/grouped`);
      if (!response.ok) {
        throw new Error('Failed to fetch grouped notes');
      }
      const data = await response.json();
      set({ groupedNotes: data, isLoading: false });

      // Also flatten notes for easy access
      const allNotes = [
        ...data.trip_level,
        ...data.by_destination.flatMap(d => d.notes)
      ];
      set({ notes: allNotes });

      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Fetch notes for a destination
  fetchDestinationNotes: async (destinationId, dayNumber = null) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (dayNumber) params.append('day_number', dayNumber);

      const queryString = params.toString();
      const url = `${API_BASE_URL}/destinations/${destinationId}/notes${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch destination notes');
      }
      const data = await response.json();
      set({ notes: data.notes, isLoading: false });
      return data.notes;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  // Fetch destination notes grouped by day
  fetchDestinationNotesByDay: async (destinationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/destinations/${destinationId}/notes/by-day`);
      if (!response.ok) {
        throw new Error('Failed to fetch notes by day');
      }
      const data = await response.json();
      set({ notesByDay: data, isLoading: false });
      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Fetch note stats for a trip
  fetchNoteStats: async (tripId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/notes/stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch note stats');
      }
      const data = await response.json();
      set({ noteStats: data });
      return data;
    } catch (error) {
      set({ error: error.message });
      return null;
    }
  },

  // Get a single note
  fetchNote: async (noteId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/notes/${noteId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch note');
      }
      const note = await response.json();
      set({ selectedNote: note, isLoading: false });
      return note;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Create a new note
  createNote: async (tripId, noteData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...noteData, trip_id: tripId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create note');
      }

      const newNote = await response.json();
      set((state) => ({
        notes: [newNote, ...state.notes],
        isLoading: false,
      }));

      // Refresh grouped notes if we have them
      if (get().groupedNotes) {
        get().fetchTripNotesGrouped(tripId);
      }

      return newNote;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Update a note
  updateNote: async (noteId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update note');
      }

      const updatedNote = await response.json();
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === noteId ? updatedNote : n
        ),
        selectedNote: state.selectedNote?.id === noteId
          ? updatedNote
          : state.selectedNote,
        isLoading: false,
      }));
      return updatedNote;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Delete a note
  deleteNote: async (noteId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      set((state) => ({
        notes: state.notes.filter((n) => n.id !== noteId),
        selectedNote: state.selectedNote?.id === noteId
          ? null
          : state.selectedNote,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Toggle pin status
  togglePin: async (noteId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notes/${noteId}/toggle-pin`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to toggle pin');
      }

      const updatedNote = await response.json();
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === noteId ? updatedNote : n
        ),
        selectedNote: state.selectedNote?.id === noteId
          ? updatedNote
          : state.selectedNote,
      }));
      return updatedNote;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Search notes
  searchNotes: async (tripId, query, filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/notes/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          ...filters,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search notes');
      }

      const data = await response.json();
      set({ searchResults: data, isLoading: false });
      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Upload media to a note
  uploadMedia: async (noteId, file) => {
    set({ isUploading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/notes/${noteId}/media`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload media');
      }

      const updatedNote = await response.json();
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === noteId ? updatedNote : n
        ),
        selectedNote: state.selectedNote?.id === noteId
          ? updatedNote
          : state.selectedNote,
        isUploading: false,
      }));
      return updatedNote;
    } catch (error) {
      set({ error: error.message, isUploading: false });
      throw error;
    }
  },

  // Delete media from a note
  deleteMedia: async (noteId, filename) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/notes/${noteId}/media/${filename}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete media');
      }

      const updatedNote = await response.json();
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === noteId ? updatedNote : n
        ),
        selectedNote: state.selectedNote?.id === noteId
          ? updatedNote
          : state.selectedNote,
        isLoading: false,
      }));
      return updatedNote;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Get media URL
  getMediaUrl: (noteId, filename) => `${API_BASE_URL}/notes/${noteId}/media/${filename}`,

  // Export notes to markdown
  getExportUrl: (tripId, noteIds = null) => {
    let url = `${API_BASE_URL}/trips/${tripId}/notes/export/markdown`;
    if (noteIds && noteIds.length > 0) {
      url += `?note_ids=${noteIds.join(',')}`;
    }
    return url;
  },

  // Reset store
  resetNotes: () => set({
    notes: [],
    groupedNotes: null,
    notesByDay: null,
    selectedNote: null,
    noteStats: null,
    isLoading: false,
    isUploading: false,
    error: null,
    searchResults: null,
  }),
}));

export default useNoteStore;
