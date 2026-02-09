import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Download,
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
  MapPin,
  Calendar,
} from 'lucide-react';
import FileDescriptionIcon from '@/components/icons/file-description-icon';
import TrashIcon from '@/components/icons/trash-icon';
import ExternalLinkIcon from '@/components/icons/external-link-icon';
import EyeIcon from '@/components/icons/eye-icon';
import CheckedIcon from '@/components/icons/checked-icon';
import StarIcon from '@/components/icons/star-icon';
import { formatDateForDocument } from '../../utils/dateFormat';

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
  emptyMessage,
  compact = false,
  destinations = [],
}) => {
  const { t } = useTranslation();
  const displayEmptyMessage = emptyMessage || t('documents.noDocuments');

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    return formatDateForDocument(dateString);
  };

  const getFileIcon = (mimeType, size = 5) => {
    if (mimeType?.startsWith('image/')) {
      return <Image className={`w-${size} h-${size} text-[#D97706]`} />;
    }
    return <FileDescriptionIcon className={`w-${size} h-${size} text-red-500`} />;
  };

  const getTypeIcon = (documentType) => {
    const IconComponent = DOCUMENT_TYPE_ICONS[documentType] || File;
    return <IconComponent className="w-3 h-3" />;
  };

  const getDestinationName = (destinationId) => {
    const dest = destinations.find(d => d.id === destinationId);
    return dest ? dest.city_name : null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#D97706]"></div>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className={`text-center ${compact ? 'py-3' : 'py-6'} text-gray-500 text-sm`}>
        {!compact && <FileDescriptionIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />}
        <p>{displayEmptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={`group flex items-center ${compact ? 'p-2' : 'p-3'} bg-white border border-gray-200 rounded-lg hover:border-amber-200 hover:shadow-sm transition-all duration-200`}
        >
          {/* File Icon */}
          <div className={`flex-shrink-0 ${compact ? 'mr-2' : 'mr-3'}`}>
            {getFileIcon(doc.mime_type, compact ? 4 : 5)}
          </div>

          {/* Document Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-1">
              <h4 className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-900 truncate`}>
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

            {/* Location badges (destination and day) */}
            {(doc.destination_id || doc.day_number) && (
              <div className="flex items-center flex-wrap gap-1 mt-1">
                {doc.destination_id && (
                  <span className="inline-flex items-center text-xs text-[#D97706] bg-amber-50 px-1.5 py-0.5 rounded">
                    <MapPin className="w-3 h-3 mr-0.5" />
                    {getDestinationName(doc.destination_id) || `Dest #${doc.destination_id}`}
                  </span>
                )}
                {doc.day_number && (
                  <span className="inline-flex items-center text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    <Calendar className="w-3 h-3 mr-0.5" />
                    {t('common.day')} {doc.day_number}
                  </span>
                )}
              </div>
            )}

            <div className={`flex items-center space-x-2 ${compact ? 'text-xs' : 'text-xs'} text-gray-500 mt-0.5`}>
              <span>{formatFileSize(doc.file_size)}</span>
              <span>-</span>
              <span>{formatDate(doc.created_at)}</span>
            </div>
            {!compact && doc.description && (
              <p className="text-xs text-gray-500 mt-1 truncate">{doc.description}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className={`flex items-center ${compact ? 'space-x-0.5 ml-1' : 'space-x-1 ml-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <button
              onClick={() => onView(doc.id)}
              className={`${compact ? 'p-1' : 'p-1.5'} text-gray-400 hover:text-[#D97706] hover:bg-amber-50 rounded transition-colors`}
              title={t('common.view')}
            >
              <EyeIcon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
            <button
              onClick={() => onDownload(doc.id)}
              className={`${compact ? 'p-1' : 'p-1.5'} text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors`}
              title={t('common.download')}
            >
              <Download className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
            <button
              onClick={() => onDelete(doc.id)}
              className={`${compact ? 'p-1' : 'p-1.5'} text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors`}
              title={t('common.delete')}
            >
              <TrashIcon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DocumentList;
