import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Save,
  Tag,
  Lock,
  Unlock,
  Pin,
} from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import GlobeIcon from '@/components/icons/globe-icon';
import RichTextEditor from './RichTextEditor';
import Spinner from '../UI/Spinner';

const NoteFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  note = null, // null for new note, object for editing
  tripId: _tripId, // eslint-disable-line no-unused-vars
  destinations = [],
  pois = [],
  isSaving = false,
  preselectedDestinationId = null,
  preselectedDayNumber = null,
  preselectedPoiId = null,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    note_type: 'general',
    destination_id: null,
    day_number: null,
    poi_id: null,
    is_pinned: false,
    is_private: true,
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});

  // Initialize form data
  useEffect(() => {
    if (isOpen) {
      if (note) {
        // Editing existing note
        setFormData({
          title: note.title || '',
          content: note.content || '',
          note_type: note.note_type || 'general',
          destination_id: note.destination_id,
          day_number: note.day_number,
          poi_id: note.poi_id,
          is_pinned: note.is_pinned || false,
          is_private: note.is_private !== false,
          tags: note.tags || [],
        });
      } else {
        // Creating new note
        setFormData({
          title: '',
          content: '',
          note_type: preselectedPoiId ? 'poi' : preselectedDayNumber ? 'day' : preselectedDestinationId ? 'destination' : 'general',
          destination_id: preselectedDestinationId,
          day_number: preselectedDayNumber,
          poi_id: preselectedPoiId,
          is_pinned: false,
          is_private: true,
          tags: [],
        });
      }
      setErrors({});
      setTagInput('');
    }
  }, [isOpen, note, preselectedDestinationId, preselectedDayNumber, preselectedPoiId]);

  // Get available POIs based on selected destination
  // POIs may come as either flat array or array of category groups
  const flattenedPois = React.useMemo(() => {
    if (!pois || pois.length === 0) return [];
    // Check if it's category-grouped (first item has 'pois' array)
    if (pois[0]?.pois) {
      return pois.flatMap(group => group.pois || []);
    }
    // Already flat array
    return pois;
  }, [pois]);

  const availablePois = formData.destination_id
    ? flattenedPois.filter(p => p.destination_id === formData.destination_id)
    : flattenedPois;

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-update note_type based on selections
      if (field === 'poi_id' && value) {
        updated.note_type = 'poi';
      } else if (field === 'day_number' && value) {
        updated.note_type = 'day';
      } else if (field === 'destination_id' && value && !updated.day_number && !updated.poi_id) {
        updated.note_type = 'destination';
      }

      // Clear dependent fields when parent changes
      if (field === 'destination_id') {
        updated.poi_id = null;
        if (!value) {
          updated.day_number = null;
        }
      }

      return updated;
    });
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove),
    }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = t('journal.titleRequired');
    }
    if (formData.day_number && !formData.destination_id) {
      newErrors.day_number = t('journal.dayRequiresDestination');
    }
    if (formData.poi_id && !formData.destination_id) {
      newErrors.poi_id = t('journal.poiRequiresDestination');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    onSubmit({
      ...formData,
      destination_id: formData.destination_id || null,
      day_number: formData.day_number || null,
      poi_id: formData.poi_id || null,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {note ? t('journal.editNote') : t('journal.addNote')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('journal.noteTitle')} *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={t('journal.enterTitle')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            {/* Organization: Destination, Day, POI */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('journal.destination')}
                </label>
                <select
                  value={formData.destination_id || ''}
                  onChange={(e) => handleChange('destination_id', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('journal.tripLevel')}</option>
                  {destinations.map((dest) => (
                    <option key={dest.id} value={dest.id}>
                      {dest.city_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('journal.day')}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.day_number || ''}
                  onChange={(e) => handleChange('day_number', e.target.value ? Number(e.target.value) : null)}
                  disabled={!formData.destination_id}
                  placeholder={t('journal.dayNumber')}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    !formData.destination_id ? 'opacity-50' : ''
                  } ${errors.day_number ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('journal.poi')}
                </label>
                <select
                  value={formData.poi_id || ''}
                  onChange={(e) => handleChange('poi_id', e.target.value ? Number(e.target.value) : null)}
                  disabled={!formData.destination_id || availablePois.length === 0}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    !formData.destination_id || availablePois.length === 0 ? 'opacity-50' : ''
                  }`}
                >
                  <option value="">{t('common.none')}</option>
                  {availablePois.map((poi) => (
                    <option key={poi.id} value={poi.id}>
                      {poi.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('journal.content')}
              </label>
              <RichTextEditor
                value={formData.content}
                onChange={(value) => handleChange('content', value)}
                placeholder={t('journal.contentPlaceholder')}
                minHeight="150px"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Tag className="w-4 h-4 inline mr-1" />
                {t('journal.tags')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={t('journal.addTag')}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-[#D97706] dark:text-amber-300 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-amber-900 dark:hover:text-amber-100"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_pinned}
                  onChange={(e) => handleChange('is_pinned', e.target.checked)}
                  className="w-4 h-4 text-[#D97706] border-gray-300 rounded focus:ring-[#D97706]/50"
                />
                <Pin className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('journal.pinNote')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_private}
                  onChange={(e) => handleChange('is_private', e.target.checked)}
                  className="w-4 h-4 text-[#D97706] border-gray-300 rounded focus:ring-[#D97706]/50"
                />
                {formData.is_private ? (
                  <Lock className="w-4 h-4 text-gray-500" />
                ) : (
                  <Unlock className="w-4 h-4 text-green-500" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {formData.is_private ? t('common.private') : t('common.shared')}
                </span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Spinner className="text-white" />
                {t('common.saving')}
              </>
            ) : (
              <>
                {note ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {note ? t('journal.saveChanges') : t('journal.addNote')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteFormModal;
