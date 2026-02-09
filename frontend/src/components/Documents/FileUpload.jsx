import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Image, MapPin, Calendar } from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import FileDescriptionIcon from '@/components/icons/file-description-icon';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import FilledCheckedIcon from '@/components/icons/filled-checked-icon';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const DOCUMENT_TYPE_KEYS = [
  { value: 'flight', labelKey: 'documents.documentTypes.flight' },
  { value: 'hotel', labelKey: 'documents.documentTypes.hotel' },
  { value: 'insurance', labelKey: 'documents.documentTypes.insurance' },
  { value: 'visa', labelKey: 'documents.documentTypes.visa' },
  { value: 'ticket', labelKey: 'documents.documentTypes.ticket' },
  { value: 'confirmation', labelKey: 'documents.documentTypes.confirmation' },
  { value: 'reservation', labelKey: 'documents.documentTypes.reservation' },
  { value: 'receipt', labelKey: 'documents.documentTypes.receipt' },
  { value: 'map', labelKey: 'documents.documentTypes.map' },
  { value: 'other', labelKey: 'documents.documentTypes.other' },
];

const FileUpload = ({ onUpload, isUploading, error, destinations = [] }) => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('other');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef(null);

  // Calculate number of days for selected destination
  const availableDays = useMemo(() => {
    if (!selectedDestination) return [];
    const dest = destinations.find(d => d.id === parseInt(selectedDestination));
    if (!dest || !dest.arrival_date || !dest.departure_date) return [];

    const arrival = new Date(dest.arrival_date);
    const departure = new Date(dest.departure_date);
    const numDays = Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24));

    return Array.from({ length: numDays }, (_, i) => ({
      value: i + 1,
      labelKey: i + 1,
    }));
  }, [selectedDestination, destinations]);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return t('documents.invalidFileType');
    }
    if (file.size > MAX_FILE_SIZE) {
      return t('documents.fileSizeExceeded');
    }
    return null;
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    setValidationError(null);
    setUploadSuccess(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }
      setSelectedFile(file);
      // Auto-fill title from filename if empty
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
    }
  }, [title]);

  const handleFileSelect = useCallback((e) => {
    setValidationError(null);
    setUploadSuccess(false);
    const file = e.target.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }
      setSelectedFile(file);
      // Auto-fill title from filename if empty
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
    }
  }, [title]);

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setValidationError(null);
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDestinationChange = (e) => {
    setSelectedDestination(e.target.value);
    // Reset day selection when destination changes
    setSelectedDay('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    try {
      const metadata = {
        document_type: documentType,
        title: title || null,
        description: description || null,
      };

      // Add destination and day if selected
      if (selectedDestination) {
        metadata.destination_id = parseInt(selectedDestination);
        if (selectedDay) {
          metadata.day_number = parseInt(selectedDay);
        }
      }

      await onUpload(selectedFile, metadata);
      setUploadSuccess(true);
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setDocumentType('other');
      setSelectedDestination('');
      setSelectedDay('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch {
      // Error handled by parent
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) {
      return <Image className="w-8 h-8 text-[#D97706]" />;
    }
    return <FileDescriptionIcon className="w-8 h-8 text-red-500" />;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200
          ${isDragOver
            ? 'border-[#D97706] bg-amber-50'
            : 'border-gray-300 hover:border-amber-400 hover:bg-gray-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!selectedFile ? (
          <>
            <Upload className={`mx-auto w-10 h-10 ${isDragOver ? 'text-[#D97706]' : 'text-gray-400'}`} />
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-[#D97706]">{t('documents.clickToUpload')}</span> {t('documents.dragAndDrop')}
            </p>
            <p className="mt-1 text-xs text-gray-500">{t('documents.fileFormats')}</p>
          </>
        ) : (
          <div className="flex items-center justify-center space-x-3">
            {getFileIcon(selectedFile.type)}
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFile();
              }}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          <InfoCircleIcon className="w-4 h-4 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Upload Error */}
      {error && (
        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          <InfoCircleIcon className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Success */}
      {uploadSuccess && (
        <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 p-2 rounded">
          <FilledCheckedIcon className="w-4 h-4 flex-shrink-0" />
          <span>{t('documents.uploadSuccess')}</span>
        </div>
      )}

      {/* Document Metadata */}
      {selectedFile && (
        <div className="space-y-3 pt-2">
          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('documents.documentType')}
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#D97706]/50 focus:border-[#D97706] text-sm"
            >
              {DOCUMENT_TYPE_KEYS.map((type) => (
                <option key={type.value} value={type.value}>
                  {t(type.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Selector */}
          {destinations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                  {t('documents.destinationOptional')}
                </span>
              </label>
              <select
                value={selectedDestination}
                onChange={handleDestinationChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#D97706]/50 focus:border-[#D97706] text-sm"
              >
                <option value="">{t('documents.tripLevelDocument')}</option>
                {destinations.map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.city_name}{dest.country ? `, ${dest.country}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Day Selector (only shown when destination is selected) */}
          {selectedDestination && availableDays.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                  {t('documents.dayOptional')}
                </span>
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#D97706]/50 focus:border-[#D97706] text-sm"
              >
                <option value="">{t('documents.generalAllDays')}</option>
                {availableDays.map((day) => (
                  <option key={day.value} value={day.value}>
                    {t('common.day')} {day.labelKey}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('documents.titleOptional')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('documents.titlePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#D97706]/50 focus:border-[#D97706] text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('documents.descriptionOptional')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t('documents.descriptionPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#D97706]/50 focus:border-[#D97706] text-sm resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isUploading}
            className={`
              w-full py-2 px-4 rounded-md text-white font-medium text-sm
              transition-colors duration-200
              ${isUploading
                ? 'bg-amber-400 cursor-not-allowed'
                : 'bg-[#D97706] hover:bg-[#B45309]'
              }
            `}
          >
            {isUploading ? t('common.uploading') : t('documents.uploadButton')}
          </button>
        </div>
      )}
    </form>
  );
};

export default FileUpload;
