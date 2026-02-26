import { create } from 'zustand';
import authFetch from '../utils/authFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const WRITING_SYSTEM_PROMPT =
  'Eres un asistente de escritura de viajes. Ayudas al usuario a redactar documentos de viaje en formato markdown, claros, atractivos y bien estructurados. Cuando el usuario pide un borrador, usa los datos del viaje que se te proporcionan como contexto. Escribe en primera persona si no se indica lo contrario.';

// Derive document status from content
function getDocStatus(content) {
  if (!content || content.trim() === '') return 'empty';
  if (content.trim().length < 50) return 'draft';
  return 'saved';
}

let _autoSaveTimers = {};

const useExportWriterStore = create((set, get) => ({
  // Map of noteId → { id, title, content, destinationId, status }
  documents: {},
  // The currently selected document ID
  selectedDocId: null,
  // Set of noteIds selected for export
  selectedForExport: new Set(),
  // 'idle' | 'saving' | 'saved' | 'error'
  saveStatus: 'idle',
  // Loading state
  isLoading: false,
  error: null,

  // Load all export_draft notes for a trip. Creates placeholders for missing destinations.
  loadDocuments: async (tripId, destinations = []) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams({ note_type: 'export_draft' });
      const url = `${API_BASE_URL}/trips/${tripId}/notes?${params}`;
      const response = await authFetch(url);
      if (!response.ok) throw new Error('Failed to fetch export drafts');
      const data = await response.json();
      const existingNotes = data.notes || [];

      const documents = {};

      // Find or create overview document (destination_id = null)
      let overviewNote = existingNotes.find((n) => !n.destination_id);
      if (!overviewNote) {
        overviewNote = await get().createDocument(tripId, null, 'Trip Overview');
      }
      if (overviewNote) {
        documents[overviewNote.id] = {
          id: overviewNote.id,
          title: overviewNote.title,
          content: overviewNote.content || '',
          destinationId: null,
          status: getDocStatus(overviewNote.content),
        };
      }

      // Find or create one document per destination
      for (const dest of destinations) {
        let note = existingNotes.find((n) => n.destination_id === dest.id);
        if (!note) {
          note = await get().createDocument(tripId, dest.id, dest.city_name);
        }
        if (note) {
          documents[note.id] = {
            id: note.id,
            title: note.title,
            content: note.content || '',
            destinationId: dest.id,
            status: getDocStatus(note.content),
          };
        }
      }

      // Pre-select first document
      const firstId = Object.keys(documents)[0] || null;
      set({
        documents,
        selectedDocId: firstId,
        selectedForExport: new Set(),
        isLoading: false,
      });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Create a new export_draft note
  createDocument: async (tripId, destinationId, title) => {
    try {
      const body = {
        trip_id: tripId,
        destination_id: destinationId || null,
        note_type: 'export_draft',
        title: title || 'Untitled',
        content: '',
      };
      const response = await authFetch(`${API_BASE_URL}/trips/${tripId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to create document');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to create export document:', error);
      return null;
    }
  },

  // Select a document by noteId
  selectDocument: (noteId) => {
    set({ selectedDocId: noteId });
  },

  // Toggle a document in the export selection
  toggleExportSelection: (noteId) => {
    set((state) => {
      const next = new Set(state.selectedForExport);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return { selectedForExport: next };
    });
  },

  // Select all documents for export
  selectAllForExport: () => {
    set((state) => ({
      selectedForExport: new Set(Object.keys(state.documents).map(Number)),
    }));
  },

  // Clear export selection
  clearExportSelection: () => {
    set({ selectedForExport: new Set() });
  },

  // Update content locally and schedule auto-save
  updateContent: (noteId, content) => {
    set((state) => ({
      documents: {
        ...state.documents,
        [noteId]: {
          ...state.documents[noteId],
          content,
          status: getDocStatus(content),
        },
      },
      saveStatus: 'idle',
    }));

    // Debounce auto-save (2s)
    if (_autoSaveTimers[noteId]) {
      clearTimeout(_autoSaveTimers[noteId]);
    }
    _autoSaveTimers[noteId] = setTimeout(async () => {
      await get().saveDocument(noteId);
    }, 2000);
  },

  // Save a document immediately
  saveDocument: async (noteId) => {
    const doc = get().documents[noteId];
    if (!doc) return;

    set({ saveStatus: 'saving' });
    try {
      const response = await authFetch(`${API_BASE_URL}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: doc.content }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to save');
      }
      set({ saveStatus: 'saved' });
      // Reset to idle after 3s
      setTimeout(() => {
        if (get().saveStatus === 'saved') set({ saveStatus: 'idle' });
      }, 3000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      set({ saveStatus: 'error' });
    }
  },

  // Get selected document data
  getSelectedDocument: () => {
    const { documents, selectedDocId } = get();
    return selectedDocId ? documents[selectedDocId] : null;
  },

  // Reset store
  reset: () => {
    // Cancel any pending saves
    Object.values(_autoSaveTimers).forEach(clearTimeout);
    _autoSaveTimers = {};
    set({
      documents: {},
      selectedDocId: null,
      selectedForExport: new Set(),
      saveStatus: 'idle',
      isLoading: false,
      error: null,
    });
  },
}));

export default useExportWriterStore;
