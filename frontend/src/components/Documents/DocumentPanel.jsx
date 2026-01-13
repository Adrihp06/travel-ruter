import React, { useState, useEffect } from 'react';
import { FolderOpen, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import FileUpload from './FileUpload';
import DocumentList from './DocumentList';
import useDocumentStore from '../../stores/useDocumentStore';

const DocumentPanel = ({ poiId, tripId, title = 'The Vault' }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const {
    documents,
    isLoading,
    isUploading,
    error,
    fetchPOIDocuments,
    fetchTripDocuments,
    uploadPOIDocument,
    uploadTripDocument,
    deleteDocument,
    getDownloadUrl,
    getViewUrl,
    clearError,
  } = useDocumentStore();

  // Fetch documents when POI or Trip changes
  useEffect(() => {
    if (poiId) {
      fetchPOIDocuments(poiId);
    } else if (tripId) {
      fetchTripDocuments(tripId);
    }
  }, [poiId, tripId, fetchPOIDocuments, fetchTripDocuments]);

  const handleUpload = async (file, metadata) => {
    if (poiId) {
      await uploadPOIDocument(poiId, file, metadata);
    } else if (tripId) {
      await uploadTripDocument(tripId, file, metadata);
    }
    setShowUpload(false);
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <FolderOpen className="w-5 h-5 text-indigo-600" />
          <h3 className="font-medium text-gray-900">{title}</h3>
          {documents.length > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {documents.length}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowUpload(!showUpload);
              if (!isExpanded) setIsExpanded(true);
            }}
            className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Add document"
          >
            <Plus className="w-4 h-4" />
          </button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3">
          {/* Upload Section */}
          {showUpload && (
            <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Upload Document</h4>
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
          <DocumentList
            documents={documents}
            onView={handleView}
            onDownload={handleDownload}
            onDelete={handleDelete}
            isLoading={isLoading}
            emptyMessage="No documents yet. Click + to upload tickets, confirmations, or receipts."
          />
        </div>
      )}
    </div>
  );
};

export default DocumentPanel;
