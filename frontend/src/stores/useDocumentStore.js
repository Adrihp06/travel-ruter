import { create } from 'zustand';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const useDocumentStore = create((set, get) => ({
  documents: [],
  selectedDocument: null,
  isLoading: false,
  isUploading: false,
  uploadProgress: 0,
  error: null,

  // Setters
  setDocuments: (documents) => set({ documents }),
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
  fetchTripDocuments: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/documents`);
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

  // Upload document to Trip
  uploadTripDocument: async (tripId, file, metadata = {}) => {
    set({ isUploading: true, uploadProgress: 0, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (metadata.document_type) formData.append('document_type', metadata.document_type);
      if (metadata.title) formData.append('title', metadata.title);
      if (metadata.description) formData.append('description', metadata.description);

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
      return newDocument;
    } catch (error) {
      set({ error: error.message, isUploading: false, uploadProgress: 0 });
      throw error;
    }
  },

  // Update document metadata
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
        throw new Error('Failed to update document');
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
    selectedDocument: null,
    isLoading: false,
    isUploading: false,
    uploadProgress: 0,
    error: null,
  }),
}));

export default useDocumentStore;
