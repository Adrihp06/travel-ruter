import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const useDocumentStore = create((set, get) => ({
  documents: [],
  groupedDocuments: null, // { trip_level: [], by_destination: [], total_count: 0 }
  selectedDocument: null,
  isLoading: false,
  isUploading: false,
  uploadProgress: 0,
  error: null,
  viewMode: 'all', // 'all' | 'byDestination' | 'byDay'

  // Setters
  setDocuments: (documents) => set({ documents }),
  setViewMode: (viewMode) => set({ viewMode }),
  selectDocument: (documentId) => set((state) => ({
    selectedDocument: state.documents.find((d) => d.id === documentId) || null
  })),
  clearError: () => set({ error: null }),

  // Fetch documents for a POI
  fetchPOIDocuments: async (poiId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/pois/${poiId}/documents`);
      if (!response.ok) {
        throw new Error('Failed to fetch POI documents');
      }
      const data = await response.json();
      set({ documents: data.documents, isLoading: false });
      return data.documents;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  // Fetch documents for a Trip
  fetchTripDocuments: async (tripId, filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters.destination_id) params.append('destination_id', filters.destination_id);
      if (filters.day) params.append('day', filters.day);
      if (filters.document_type) params.append('document_type', filters.document_type);

      const queryString = params.toString();
      const url = `${API_BASE_URL}/trips/${tripId}/documents${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch trip documents');
      }
      const data = await response.json();
      set({ documents: data.documents, isLoading: false });
      return data.documents;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  // Fetch documents grouped by destination
  fetchTripDocumentsGrouped: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/documents/grouped`);
      if (!response.ok) {
        throw new Error('Failed to fetch grouped documents');
      }
      const data = await response.json();
      set({ groupedDocuments: data, isLoading: false });

      // Also flatten documents for easy access
      const allDocs = [
        ...data.trip_level,
        ...data.by_destination.flatMap(d => d.documents)
      ];
      set({ documents: allDocs });

      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Fetch documents for a destination
  fetchDestinationDocuments: async (destinationId, day = null) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (day) params.append('day', day);

      const queryString = params.toString();
      const url = `${API_BASE_URL}/destinations/${destinationId}/documents${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch destination documents');
      }
      const data = await response.json();
      set({ documents: data.documents, isLoading: false });
      return data.documents;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  // Fetch destination documents grouped by day
  fetchDestinationDocumentsByDay: async (destinationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/destinations/${destinationId}/documents/by-day`);
      if (!response.ok) {
        throw new Error('Failed to fetch documents by day');
      }
      const data = await response.json();
      set({ isLoading: false });
      return data; // { general: [], by_day: {}, total_count: 0 }
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Upload document to POI
  uploadPOIDocument: async (poiId, file, metadata = {}) => {
    set({ isUploading: true, uploadProgress: 0, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (metadata.document_type) formData.append('document_type', metadata.document_type);
      if (metadata.title) formData.append('title', metadata.title);
      if (metadata.description) formData.append('description', metadata.description);

      const response = await fetch(`${API_BASE_URL}/pois/${poiId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload document');
      }

      const newDocument = await response.json();
      set((state) => ({
        documents: [newDocument, ...state.documents],
        isUploading: false,
        uploadProgress: 100,
      }));
      return newDocument;
    } catch (error) {
      set({ error: error.message, isUploading: false, uploadProgress: 0 });
      throw error;
    }
  },

  // Upload document to Trip with optional destination and day
  uploadTripDocument: async (tripId, file, metadata = {}) => {
    set({ isUploading: true, uploadProgress: 0, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (metadata.document_type) formData.append('document_type', metadata.document_type);
      if (metadata.title) formData.append('title', metadata.title);
      if (metadata.description) formData.append('description', metadata.description);
      if (metadata.destination_id) formData.append('destination_id', metadata.destination_id);
      if (metadata.day_number) formData.append('day_number', metadata.day_number);

      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload document');
      }

      const newDocument = await response.json();
      set((state) => ({
        documents: [newDocument, ...state.documents],
        isUploading: false,
        uploadProgress: 100,
      }));

      // Refresh grouped documents if we have them
      if (get().groupedDocuments) {
        get().fetchTripDocumentsGrouped(tripId);
      }

      return newDocument;
    } catch (error) {
      set({ error: error.message, isUploading: false, uploadProgress: 0 });
      throw error;
    }
  },

  // Update document metadata (including destination/day assignment)
  updateDocument: async (documentId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update document');
      }

      const updatedDocument = await response.json();
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === documentId ? updatedDocument : d
        ),
        selectedDocument: state.selectedDocument?.id === documentId
          ? updatedDocument
          : state.selectedDocument,
        isLoading: false,
      }));
      return updatedDocument;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Reassign document to destination/day
  reassignDocument: async (documentId, destinationId, dayNumber = null) => {
    const updates = {
      destination_id: destinationId,
      day_number: dayNumber,
    };
    return get().updateDocument(documentId, updates);
  },

  // Delete document
  deleteDocument: async (documentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      set((state) => ({
        documents: state.documents.filter((d) => d.id !== documentId),
        selectedDocument: state.selectedDocument?.id === documentId
          ? null
          : state.selectedDocument,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Get download URL
  getDownloadUrl: (documentId) => `${API_BASE_URL}/documents/${documentId}/download`,

  // Get view URL (for inline viewing)
  getViewUrl: (documentId) => `${API_BASE_URL}/documents/${documentId}/view`,

  // Reset store
  resetDocuments: () => set({
    documents: [],
    groupedDocuments: null,
    selectedDocument: null,
    isLoading: false,
    isUploading: false,
    uploadProgress: 0,
    error: null,
    viewMode: 'all',
  }),
}));

export default useDocumentStore;
