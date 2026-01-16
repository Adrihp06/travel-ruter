import React from 'react';
import {
  FileText,
  Image,
  Download,
  Eye,
  Trash2,
  Ticket,
  CalendarCheck,
  Receipt,
  Map,
  File,
  Plane,
  Building2,
  Shield,
  Stamp,
  Utensils,
} from 'lucide-react';

const DOCUMENT_TYPE_ICONS = {
  flight: Plane,
  hotel: Building2,
  insurance: Shield,
  visa: Stamp,
  ticket: Ticket,
  confirmation: CalendarCheck,
  reservation: Utensils,
  receipt: Receipt,
  map: Map,
  other: File,
};

const DOCUMENT_TYPE_COLORS = {
  flight: 'bg-sky-100 text-sky-700',
  hotel: 'bg-amber-100 text-amber-700',
  insurance: 'bg-emerald-100 text-emerald-700',
  visa: 'bg-rose-100 text-rose-700',
  ticket: 'bg-purple-100 text-purple-700',
  confirmation: 'bg-green-100 text-green-700',
  reservation: 'bg-blue-100 text-blue-700',
  receipt: 'bg-yellow-100 text-yellow-700',
  map: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
};

const DocumentList = ({
  documents,
  onView,
  onDownload,
  onDelete,
  isLoading,
  emptyMessage = 'No documents uploaded yet',
}) => {
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) {
      return <Image className="w-5 h-5 text-indigo-500" />;
    }
    return <FileText className="w-5 h-5 text-red-500" />;
  };

  const getTypeIcon = (documentType) => {
    const IconComponent = DOCUMENT_TYPE_ICONS[documentType] || File;
    return <IconComponent className="w-3 h-3" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="group flex items-center p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all duration-200"
        >
          {/* File Icon */}
          <div className="flex-shrink-0 mr-3">
            {getFileIcon(doc.mime_type)}
          </div>

          {/* Document Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {doc.title || doc.original_filename}
              </h4>
              <span
                className={`
                  inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-medium
                  ${DOCUMENT_TYPE_COLORS[doc.document_type] || DOCUMENT_TYPE_COLORS.other}
                `}
              >
                {getTypeIcon(doc.document_type)}
                <span className="capitalize">{doc.document_type}</span>
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500 mt-0.5">
              <span>{formatFileSize(doc.file_size)}</span>
              <span>-</span>
              <span>{formatDate(doc.created_at)}</span>
            </div>
            {doc.description && (
              <p className="text-xs text-gray-500 mt-1 truncate">{doc.description}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onView(doc.id)}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDownload(doc.id)}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(doc.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DocumentList;
