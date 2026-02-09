import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pin,
  PinOff,
  MapPin,
  Calendar,
  Tag,
  Image,
  Cloud,
  Smile,
  Lock,
  Unlock,
} from 'lucide-react';
import PenIcon from '@/components/icons/pen-icon';
import TrashIcon from '@/components/icons/trash-icon';
import ClockIcon from '@/components/icons/clock-icon';
import StarIcon from '@/components/icons/star-icon';

const NoteCard = ({
  note,
  onEdit,
  onDelete,
  onTogglePin,
  onClick,
  compact = false,
}) => {
  const { t } = useTranslation();
  const {
    id,
    title,
    content,
    note_type,
    is_pinned,
    is_private,
    location_name,
    mood,
    weather,
    tags,
    media_files,
    created_at,
    updated_at,
  } = note;

  // Strip HTML tags for preview
  const contentPreview = content
    ? content.replace(/<[^>]*>/g, '').substring(0, 150) + (content.length > 150 ? '...' : '')
    : '';

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
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

  const handleTogglePin = (e) => {
    e.stopPropagation();
    onTogglePin?.(id);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit?.(note);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(t('journal.deleteConfirm'))) {
      onDelete?.(id);
    }
  };

  if (compact) {
    return (
      <div
        onClick={() => onClick?.(note)}
        className={`
          p-3 rounded-lg border cursor-pointer transition-all
          ${is_pinned
            ? 'border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
          }
        `}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {is_pinned && <Pin className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
              <h4 className="font-medium text-gray-900 dark:text-white truncate">{title}</h4>
            </div>
            {contentPreview && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {contentPreview}
              </p>
            )}
          </div>
          {media_files && media_files.length > 0 && (
            <div className="flex items-center text-gray-400">
              <Image className="w-4 h-4" />
              <span className="text-xs ml-1">{media_files.length}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(note)}
      className={`
        rounded-xl border transition-all cursor-pointer
        ${is_pinned
          ? 'border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md dark:hover:border-gray-600'
        }
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {is_pinned && <Pin className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className={`px-2 py-0.5 rounded-full ${noteTypeColors[note_type]}`}>
                {note_type}
              </span>
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {formatDate(created_at)}
              </span>
              {is_private ? (
                <Lock className="w-3 h-3" title={t('common.private')} />
              ) : (
                <Unlock className="w-3 h-3" title={t('common.shared')} />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleTogglePin}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={is_pinned ? t('journal.unpin') : t('journal.pin')}
            >
              {is_pinned ? (
                <PinOff className="w-4 h-4 text-yellow-500" />
              ) : (
                <Pin className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={t('common.edit')}
            >
              <PenIcon className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              title={t('common.delete')}
            >
              <TrashIcon className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {contentPreview ? (
          <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-3">
            {contentPreview}
          </p>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 text-sm italic">{t('journal.noContent')}</p>
        )}

        {/* Media preview */}
        {media_files && media_files.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Image className="w-4 h-4" />
            <span>{t('journal.attachment', { count: media_files.length })}</span>
          </div>
        )}

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {location_name && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
              <MapPin className="w-3 h-3" />
              {location_name}
            </span>
          )}
          {mood && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
              <Smile className="w-3 h-3" />
              {mood}
            </span>
          )}
          {weather && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
              <Cloud className="w-3 h-3" />
              {weather}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 text-xs text-[#D97706] dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteCard;
