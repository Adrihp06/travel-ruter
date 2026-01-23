import React, { useState, useCallback } from 'react';
import {
  X,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  MapPin,
  Calendar,
  Tag,
  Image,
  Clock,
  Cloud,
  Smile,
  Lock,
  Unlock,
  Upload,
  Download,
} from 'lucide-react';
import useNoteStore from '../../stores/useNoteStore';
import Spinner from '../UI/Spinner';

const NoteDetailModal = ({
  isOpen,
  onClose,
  note,
  onEdit,
  onDelete,
  onTogglePin,
}) => {
  const { uploadMedia, deleteMedia, getMediaUrl, isUploading } = useNoteStore();
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const noteTypeColors = {
    general: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    destination: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    day: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
    poi: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  };

  const handleMediaUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !note) return;

    setIsUploadingMedia(true);
    try {
      await uploadMedia(note.id, file);
    } catch (error) {
      console.error('Failed to upload media:', error);
      alert('Failed to upload media: ' + error.message);
    } finally {
      setIsUploadingMedia(false);
    }
  }, [note, uploadMedia]);

  const handleDeleteMedia = useCallback(async (filename) => {
    if (!note) return;
    if (!window.confirm('Delete this media file?')) return;

    try {
      await deleteMedia(note.id, filename);
    } catch (error) {
      console.error('Failed to delete media:', error);
    }
  }, [note, deleteMedia]);

  if (!isOpen || !note) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              {note.is_pinned && <Pin className="w-5 h-5 text-yellow-500 flex-shrink-0" />}
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {note.title}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className={`px-2 py-0.5 rounded-full text-xs ${noteTypeColors[note.note_type]}`}>
                {note.note_type}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(note.created_at)}
              </span>
              {note.is_private ? (
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Private
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  Shared
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onTogglePin?.(note.id)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={note.is_pinned ? 'Unpin' : 'Pin'}
            >
              {note.is_pinned ? (
                <PinOff className="w-5 h-5 text-yellow-500" />
              ) : (
                <Pin className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit?.(note);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Edit"
            >
              <Pencil className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => {
                if (window.confirm('Delete this note? This action cannot be undone.')) {
                  onDelete?.(note.id);
                  onClose();
                }
              }}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5 text-red-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-2"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Meta info */}
          <div className="flex flex-wrap gap-2">
            {note.location_name && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                <MapPin className="w-4 h-4" />
                {note.location_name}
              </span>
            )}
            {note.mood && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                <Smile className="w-4 h-4" />
                {note.mood}
              </span>
            )}
            {note.weather && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                <Cloud className="w-4 h-4" />
                {note.weather}
              </span>
            )}
          </div>

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {note.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
            dangerouslySetInnerHTML={{ __html: note.content || '<p class="text-gray-400 italic">No content</p>' }}
          />

          {/* Media */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Image className="w-4 h-4" />
                Media
                {note.media_files && note.media_files.length > 0 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({note.media_files.length})
                  </span>
                )}
              </h3>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  onChange={handleMediaUpload}
                  className="hidden"
                  disabled={isUploadingMedia}
                />
                <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  {isUploadingMedia ? (
                    <>
                      <Spinner className="w-4 h-4" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Add Media
                    </>
                  )}
                </span>
              </label>
            </div>

            {note.media_files && note.media_files.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {note.media_files.map((media, index) => {
                  const isImage = media.mime_type?.startsWith('image/');
                  const isVideo = media.mime_type?.startsWith('video/');
                  const mediaUrl = getMediaUrl(note.id, media.filename);

                  return (
                    <div
                      key={index}
                      className="relative group rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
                    >
                      {isImage ? (
                        <img
                          src={mediaUrl}
                          alt={media.original_filename}
                          className="w-full h-32 object-cover"
                        />
                      ) : isVideo ? (
                        <video
                          src={mediaUrl}
                          className="w-full h-32 object-cover"
                          controls
                        />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                            {media.original_filename}
                          </span>
                        </div>
                      )}

                      {/* Overlay with actions */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a
                          href={mediaUrl}
                          download={media.original_filename}
                          className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4 text-white" />
                        </a>
                        <button
                          onClick={() => handleDeleteMedia(media.filename)}
                          className="p-2 bg-white/20 rounded-full hover:bg-red-500/50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                No media attached
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteDetailModal;
