import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, FolderOpen, Filter, Plus, ChevronDown, ChevronRight, MapPin, Calendar, List, Layers } from 'lucide-react';
import FileUpload from './FileUpload';
import DocumentList from './DocumentList';
import useDocumentStore from '../../stores/useDocumentStore';
import useDestinationStore from '../../stores/useDestinationStore';

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

const VIEW_MODES = [
  { value: 'all', label: 'All', icon: List },
  { value: 'byDestination', label: 'By Destination', icon: MapPin },
  { value: 'byDay', label: 'By Day', icon: Calendar },
];

const DocumentVault = ({ tripId, isOpen, onClose }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedDestinations, setExpandedDestinations] = useState({});
  const [expandedDays, setExpandedDays] = useState({});
  const [selectedDestinationFilter, setSelectedDestinationFilter] = useState(null);
  const prevGroupedDocumentsRef = useRef(null);

  const {
    documents,
    groupedDocuments,
    isLoading,
    isUploading,
    error,
    viewMode,
    setViewMode,
    fetchTripDocuments,
    fetchTripDocumentsGrouped,
    uploadTripDocument,
    deleteDocument,
    getDownloadUrl,
    getViewUrl,
    clearError,
  } = useDocumentStore();

  const { destinations, fetchDestinations } = useDestinationStore();

  // Fetch documents and destinations when tripId changes or vault opens
  useEffect(() => {
    if (tripId && isOpen) {
      fetchDestinations(tripId);
      if (viewMode === 'all') {
        fetchTripDocuments(tripId);
      } else {
        fetchTripDocumentsGrouped(tripId);
      }
    }
  }, [tripId, isOpen, viewMode, fetchTripDocuments, fetchTripDocumentsGrouped, fetchDestinations]);

  // Expand all destinations by default when grouped data is loaded (only on initial load)
  useEffect(() => {
    if (groupedDocuments && viewMode !== 'all' && groupedDocuments !== prevGroupedDocumentsRef.current) {
      prevGroupedDocumentsRef.current = groupedDocuments;
      // Use a microtask to avoid the synchronous setState warning
      queueMicrotask(() => {
        const expanded = {};
        groupedDocuments.by_destination.forEach(dest => {
          expanded[dest.destination_id] = true;
        });
        setExpandedDestinations(expanded);
      });
    }
  }, [groupedDocuments, viewMode]);

  // Filter documents by category
  const filteredDocuments = useMemo(() => {
    let docs = documents;

    // Apply destination filter if set
    if (selectedDestinationFilter) {
      docs = docs.filter(doc => doc.destination_id === selectedDestinationFilter);
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      docs = docs.filter(doc => doc.document_type === selectedCategory);
    }

    return docs;
  }, [documents, selectedCategory, selectedDestinationFilter]);

  // Group documents by category for display
  const documentStats = useMemo(() => {
    const stats = {};
    documents.forEach(doc => {
      const type = doc.document_type || 'other';
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }, [documents]);

  // Calculate days for a destination
  const getDestinationDays = (destination) => {
    if (!destination.arrival_date || !destination.departure_date) return 0;
    const arrival = new Date(destination.arrival_date);
    const departure = new Date(destination.departure_date);
    return Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24));
  };

  // Group documents by day within a destination
  const groupDocsByDay = (docs) => {
    const byDay = { general: [] };
    docs.forEach(doc => {
      if (doc.day_number) {
        if (!byDay[doc.day_number]) byDay[doc.day_number] = [];
        byDay[doc.day_number].push(doc);
      } else {
        byDay.general.push(doc);
      }
    });
    return byDay;
  };

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
      // Refresh documents based on current view
      if (viewMode !== 'all') {
        fetchTripDocumentsGrouped(tripId);
      }
    }
  };

  const toggleDestination = (destId) => {
    setExpandedDestinations(prev => ({
      ...prev,
      [destId]: !prev[destId]
    }));
  };

  const toggleDay = (destId, day) => {
    const key = `${destId}-${day}`;
    setExpandedDays(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const expandAll = () => {
    if (groupedDocuments) {
      const expanded = {};
      groupedDocuments.by_destination.forEach(dest => {
        expanded[dest.destination_id] = true;
      });
      setExpandedDestinations(expanded);
    }
  };

  const collapseAll = () => {
    setExpandedDestinations({});
    setExpandedDays({});
  };

  if (!isOpen) return null;

  // Render document list view (all documents flat)
  const renderAllView = () => (
    <DocumentList
      documents={filteredDocuments}
      onView={handleView}
      onDownload={handleDownload}
      onDelete={handleDelete}
      isLoading={isLoading}
      destinations={destinations}
      emptyMessage={
        selectedCategory === 'all'
          ? 'No documents yet. Upload flight tickets, hotel reservations, or travel insurance.'
          : `No ${CATEGORY_FILTERS.find(c => c.value === selectedCategory)?.label.toLowerCase() || 'documents'} uploaded.`
      }
    />
  );

  // Render documents grouped by destination
  const renderByDestinationView = () => {
    if (!groupedDocuments) return renderAllView();

    return (
      <div className="space-y-3">
        {/* Trip-level documents */}
        {groupedDocuments.trip_level.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center">
                <FolderOpen className="w-4 h-4 mr-2 text-gray-500" />
                Trip Documents
                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {groupedDocuments.trip_level.length}
                </span>
              </h4>
            </div>
            <DocumentList
              documents={groupedDocuments.trip_level.filter(doc =>
                selectedCategory === 'all' || doc.document_type === selectedCategory
              )}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={handleDelete}
              isLoading={false}
              compact
            />
          </div>
        )}

        {/* Documents by destination */}
        {groupedDocuments.by_destination.map(destGroup => {
          const destination = destinations.find(d => d.id === destGroup.destination_id);
          const isExpanded = expandedDestinations[destGroup.destination_id];
          const filteredDocs = destGroup.documents.filter(doc =>
            selectedCategory === 'all' || doc.document_type === selectedCategory
          );

          return (
            <div key={destGroup.destination_id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleDestination(destGroup.destination_id)}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 mr-2 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2 text-gray-400" />
                  )}
                  <MapPin className="w-4 h-4 mr-2 text-indigo-500" />
                  <span className="font-medium text-gray-900">{destGroup.destination_name}</span>
                  {destination?.country && (
                    <span className="ml-2 text-xs text-gray-500">{destination.country}</span>
                  )}
                </div>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {filteredDocs.length}
                </span>
              </button>

              {isExpanded && (
                <div className="p-3 pt-0 border-t border-gray-100">
                  {filteredDocs.length > 0 ? (
                    <DocumentList
                      documents={filteredDocs}
                      onView={handleView}
                      onDownload={handleDownload}
                      onDelete={handleDelete}
                      isLoading={false}
                      compact
                      destinations={destinations}
                    />
                  ) : (
                    <p className="text-sm text-gray-500 py-2">No documents for this destination</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {groupedDocuments.by_destination.length === 0 && groupedDocuments.trip_level.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No documents yet</p>
          </div>
        )}
      </div>
    );
  };

  // Render documents grouped by destination and day
  const renderByDayView = () => {
    if (!groupedDocuments) return renderAllView();

    return (
      <div className="space-y-3">
        {/* Trip-level documents */}
        {groupedDocuments.trip_level.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center">
                <FolderOpen className="w-4 h-4 mr-2 text-gray-500" />
                Trip Documents
                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {groupedDocuments.trip_level.length}
                </span>
              </h4>
            </div>
            <DocumentList
              documents={groupedDocuments.trip_level.filter(doc =>
                selectedCategory === 'all' || doc.document_type === selectedCategory
              )}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={handleDelete}
              isLoading={false}
              compact
            />
          </div>
        )}

        {/* Documents by destination, then by day */}
        {groupedDocuments.by_destination.map(destGroup => {
          const destination = destinations.find(d => d.id === destGroup.destination_id);
          const isDestExpanded = expandedDestinations[destGroup.destination_id];
          const docsByDay = groupDocsByDay(destGroup.documents);
          const numDays = destination ? getDestinationDays(destination) : 0;
          const filteredDocs = destGroup.documents.filter(doc =>
            selectedCategory === 'all' || doc.document_type === selectedCategory
          );

          return (
            <div key={destGroup.destination_id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleDestination(destGroup.destination_id)}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  {isDestExpanded ? (
                    <ChevronDown className="w-4 h-4 mr-2 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2 text-gray-400" />
                  )}
                  <MapPin className="w-4 h-4 mr-2 text-indigo-500" />
                  <span className="font-medium text-gray-900">{destGroup.destination_name}</span>
                  {numDays > 0 && (
                    <span className="ml-2 text-xs text-gray-500">{numDays} days</span>
                  )}
                </div>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {filteredDocs.length}
                </span>
              </button>

              {isDestExpanded && (
                <div className="border-t border-gray-100">
                  {/* General documents (no day assigned) */}
                  {docsByDay.general.length > 0 && (
                    <div className="p-3 border-b border-gray-100">
                      <h5 className="text-xs font-medium text-gray-600 mb-2 flex items-center">
                        <Layers className="w-3 h-3 mr-1" />
                        General
                        <span className="ml-1 text-gray-400">({docsByDay.general.length})</span>
                      </h5>
                      <DocumentList
                        documents={docsByDay.general.filter(doc =>
                          selectedCategory === 'all' || doc.document_type === selectedCategory
                        )}
                        onView={handleView}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        isLoading={false}
                        compact
                      />
                    </div>
                  )}

                  {/* Documents by day */}
                  {Object.entries(docsByDay)
                    .filter(([key]) => key !== 'general')
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([day, dayDocs]) => {
                      const dayKey = `${destGroup.destination_id}-${day}`;
                      const isDayExpanded = expandedDays[dayKey] !== false; // Default expanded
                      const filteredDayDocs = dayDocs.filter(doc =>
                        selectedCategory === 'all' || doc.document_type === selectedCategory
                      );

                      if (filteredDayDocs.length === 0) return null;

                      return (
                        <div key={dayKey} className="p-3 border-b border-gray-100 last:border-b-0">
                          <button
                            onClick={() => toggleDay(destGroup.destination_id, day)}
                            className="flex items-center text-xs font-medium text-gray-600 mb-2 hover:text-gray-900"
                          >
                            {isDayExpanded ? (
                              <ChevronDown className="w-3 h-3 mr-1" />
                            ) : (
                              <ChevronRight className="w-3 h-3 mr-1" />
                            )}
                            <Calendar className="w-3 h-3 mr-1" />
                            Day {day}
                            <span className="ml-1 text-gray-400">({filteredDayDocs.length})</span>
                          </button>
                          {isDayExpanded && (
                            <DocumentList
                              documents={filteredDayDocs}
                              onView={handleView}
                              onDownload={handleDownload}
                              onDelete={handleDelete}
                              isLoading={false}
                              compact
                            />
                          )}
                        </div>
                      );
                    })}

                  {filteredDocs.length === 0 && (
                    <p className="text-sm text-gray-500 p-3">No documents for this destination</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {groupedDocuments.by_destination.length === 0 && groupedDocuments.trip_level.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No documents yet</p>
          </div>
        )}
      </div>
    );
  };

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

      {/* View Mode Toggle */}
      <div className="p-3 border-b border-gray-100 bg-white">
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          {VIEW_MODES.map(mode => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={`flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === mode.value
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Expand/Collapse buttons for grouped views */}
        {viewMode !== 'all' && groupedDocuments && groupedDocuments.by_destination.length > 0 && (
          <div className="flex items-center justify-end space-x-2 mt-2">
            <button
              onClick={expandAll}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              Expand all
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>

      {/* Category and Destination Filters */}
      <div className="p-3 border-b border-gray-100 bg-gray-50 space-y-2">
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

        {/* Destination filter (only in All view) */}
        {viewMode === 'all' && destinations.length > 0 && (
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <select
              value={selectedDestinationFilter || ''}
              onChange={(e) => setSelectedDestinationFilter(e.target.value ? parseInt(e.target.value) : null)}
              className="flex-1 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Destinations</option>
              {destinations.map(dest => (
                <option key={dest.id} value={dest.id}>
                  {dest.city_name}{dest.country ? `, ${dest.country}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
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
            destinations={destinations}
          />
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'all' && renderAllView()}
        {viewMode === 'byDestination' && renderByDestinationView()}
        {viewMode === 'byDay' && renderByDayView()}
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
