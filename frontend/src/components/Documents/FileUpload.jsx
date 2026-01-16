import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, Image, AlertCircle, CheckCircle } from 'lucide-react';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const DOCUMENT_TYPES = [
  { value: 'flight', label: 'Flight Ticket' },
  { value: 'hotel', label: 'Hotel Reservation' },
  { value: 'insurance', label: 'Travel Insurance' },
  { value: 'visa', label: 'Visa/Passport' },
  { value: 'ticket', label: 'Event Ticket' },
  { value: 'confirmation', label: 'Booking Confirmation' },
  { value: 'reservation', label: 'Restaurant Reservation' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'map', label: 'Map' },
  { value: 'other', label: 'Other' },
];

const FileUpload = ({ onUpload, isUploading, error }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('other');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Only PDF, JPG, and PNG files are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 50MB limit.';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    try {
      await onUpload(selectedFile, {
        document_type: documentType,
        title: title || null,
        description: description || null,
      });
      setUploadSuccess(true);
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setDocumentType('other');
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
      return <Image className="w-8 h-8 text-indigo-500" />;
    }
    return <FileText className="w-8 h-8 text-red-500" />;
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
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
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
            <Upload className={`mx-auto w-10 h-10 ${isDragOver ? 'text-indigo-500' : 'text-gray-400'}`} />
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
            </p>
            <p className="mt-1 text-xs text-gray-500">PDF, JPG, or PNG (max 50MB)</p>
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
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Upload Error */}
      {error && (
        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Success */}
      {uploadSuccess && (
        <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 p-2 rounded">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Document uploaded successfully!</span>
        </div>
      )}

      {/* Document Metadata */}
      {selectedFile && (
        <div className="space-y-3 pt-2">
          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Museum Ticket - Louvre"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Add notes about this document..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
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
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
              }
            `}
          >
            {isUploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      )}
    </form>
  );
};

export default FileUpload;
