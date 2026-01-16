import React, { useState, useEffect, useMemo } from 'react';
import { X, FolderOpen, Filter, Plus } from 'lucide-react';
import FileUpload from './FileUpload';
import DocumentList from './DocumentList';
import useDocumentStore from '../../stores/useDocumentStore';

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All Documents' },
  { value: 'flight', label: 'Flight Tickets' },
  { value: 'hotel', label: 'Hotel Reservations' },
  { value: 'insurance', label: 'Travel Insurance' },
  { value: 'visa', label: 'Visa/Passport' },
  { value: 'ticket', label: 'Tickets' },
  { value: 'confirmation', label: 'Confirmations' },
  { value: 'receipt', label: 'Receipts' },
  { value: 'other', label: 'Other' },
];

const DocumentVault = ({ tripId, isOpen, onClose }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const {
    documents,
    isLoading,
    isUploading,
    error,
    fetchTripDocuments,
    uploadTripDocument,
    deleteDocument,
    getDownloadUrl,
    getViewUrl,
    clearError,
  } = useDocumentStore();

  // Fetch documents when tripId changes or vault opens
  useEffect(() => {
    if (tripId && isOpen) {
      fetchTripDocuments(tripId);
    }
  }, [tripId, isOpen, fetchTripDocuments]);

  // Filter documents by category
  const filteredDocuments = useMemo(() => {
    if (selectedCategory === 'all') {
      return documents;
    }
    return documents.filter(doc => doc.document_type === selectedCategory);
  }, [documents, selectedCategory]);

  // Group documents by category for display
  const documentStats = useMemo(() => {
    const stats = {};
    documents.forEach(doc => {
      const type = doc.document_type || 'other';
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }, [documents]);

  const handleUpload = async (file, metadata) => {
    if (tripId) {
      await uploadTripDocument(tripId, file, metadata);
      setShowUpload(false);
    }
  };

  const handleView = (documentId) => {
    const viewUrl = getViewUrl(documentId);
    window.open(viewUrl, '_blank');
  };

  const handleDownload = (documentId) => {
    const downloadUrl = getDownloadUrl(documentId);
    window.open(downloadUrl, '_blank');
  };

  const handleDelete = async (documentId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteDocument(documentId);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed top-14 right-0 bottom-0 w-96 z-40 bg-white text-gray-900 shadow-xl border-l border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out"
      style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)', colorScheme: 'light' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
        <div className="flex items-center space-x-2">
          <FolderOpen className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Document Vault</h2>
          {documents.length > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {documents.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close document vault"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Category Filter */}
      <div className="p-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {CATEGORY_FILTERS.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
                {cat.value !== 'all' && documentStats[cat.value]
                  ? ` (${documentStats[cat.value]})`
                  : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className={`p-2 rounded-lg transition-colors ${
              showUpload
                ? 'bg-indigo-100 text-indigo-600'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            title="Upload document"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Upload Section */}
      {showUpload && (
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Upload Document</h3>
            <button
              onClick={() => {
                setShowUpload(false);
                clearError();
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
          <FileUpload
            onUpload={handleUpload}
            isUploading={isUploading}
            error={error}
          />
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-4">
        <DocumentList
          documents={filteredDocuments}
          onView={handleView}
          onDownload={handleDownload}
          onDelete={handleDelete}
          isLoading={isLoading}
          emptyMessage={
            selectedCategory === 'all'
              ? 'No documents yet. Upload flight tickets, hotel reservations, or travel insurance.'
              : `No ${CATEGORY_FILTERS.find(c => c.value === selectedCategory)?.label.toLowerCase() || 'documents'} uploaded.`
          }
        />
      </div>

      {/* Quick Stats Footer */}
      {documents.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {Object.entries(documentStats).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setSelectedCategory(type)}
                className={`text-xs px-2 py-1 rounded-full transition-colors ${
                  selectedCategory === type
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {type}: {count}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentVault;
