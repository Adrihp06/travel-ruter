import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pin,
  FileDown,
  ChevronDown,
  ChevronRight,
  MapPin,
  Calendar,
  Filter,
  BookOpen,
} from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import useNoteStore from '../../stores/useNoteStore';
import NoteCard from './NoteCard';
import NoteFormModal from './NoteFormModal';
import NoteDetailModal from './NoteDetailModal';
import Spinner from '../UI/Spinner';

const Journal = ({
  tripId,
  destinations = [],
  pois = [],
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const {
    notes,
    groupedNotes,
    noteStats,
    isLoading,
    fetchTripNotesGrouped,
    fetchNoteStats,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    searchNotes,
    searchResults,
    clearSearchResults,
    getExportUrl,
  } = useNoteStore();

  // UI state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDestinations, setExpandedDestinations] = useState({});
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'all' | 'pinned'
  const [isSaving, setIsSaving] = useState(false);

  // Fetch notes when trip changes
  useEffect(() => {
    if (tripId && isOpen) {
      fetchTripNotesGrouped(tripId);
      fetchNoteStats(tripId);
    }
  }, [tripId, isOpen, fetchTripNotesGrouped, fetchNoteStats]);

  // Handle search
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchNotes(tripId, searchQuery);
      } else {
        clearSearchResults();
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, tripId, searchNotes, clearSearchResults]);

  // Toggle destination expansion
  const toggleDestination = (destId) => {
    setExpandedDestinations(prev => ({
      ...prev,
      [destId]: !prev[destId],
    }));
  };

  // Expand all destinations by default
  useEffect(() => {
    if (groupedNotes?.by_destination) {
      const expanded = {};
      groupedNotes.by_destination.forEach(dest => {
        expanded[dest.destination_id] = true;
      });
      setExpandedDestinations(expanded);
    }
  }, [groupedNotes]);

  // Handle note creation
  const handleCreateNote = useCallback(async (noteData) => {
    setIsSaving(true);
    try {
      await createNote(tripId, noteData);
      setShowNoteModal(false);
      setEditingNote(null);
      fetchTripNotesGrouped(tripId);
      fetchNoteStats(tripId);
    } catch (error) {
      console.error('Failed to create note:', error);
    } finally {
      setIsSaving(false);
    }
  }, [tripId, createNote, fetchTripNotesGrouped, fetchNoteStats]);

  // Handle note update
  const handleUpdateNote = useCallback(async (noteData) => {
    if (!editingNote) return;
    setIsSaving(true);
    try {
      await updateNote(editingNote.id, noteData);
      setShowNoteModal(false);
      setEditingNote(null);
      fetchTripNotesGrouped(tripId);
    } catch (error) {
      console.error('Failed to update note:', error);
    } finally {
      setIsSaving(false);
    }
  }, [editingNote, tripId, updateNote, fetchTripNotesGrouped]);

  // Handle note deletion
  const handleDeleteNote = useCallback(async (noteId) => {
    try {
      await deleteNote(noteId);
      setSelectedNote(null);
      fetchTripNotesGrouped(tripId);
      fetchNoteStats(tripId);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  }, [deleteNote, tripId, fetchTripNotesGrouped, fetchNoteStats]);

  // Handle pin toggle
  const handleTogglePin = useCallback(async (noteId) => {
    try {
      await togglePin(noteId);
      fetchTripNotesGrouped(tripId);
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  }, [togglePin, tripId, fetchTripNotesGrouped]);

  // Handle edit
  const handleEdit = useCallback((note) => {
    setEditingNote(note);
    setShowNoteModal(true);
  }, []);

  // Handle note click
  const handleNoteClick = useCallback((note) => {
    setSelectedNote(note);
  }, []);

  // Handle export
  const handleExport = () => {
    window.open(getExportUrl(tripId), '_blank');
  };

  // Get display notes based on view mode and search
  const getDisplayNotes = () => {
    if (searchResults && searchQuery.trim().length >= 2) {
      return { type: 'search', notes: searchResults.notes };
    }

    if (viewMode === 'pinned') {
      return { type: 'pinned', notes: groupedNotes?.pinned || [] };
    }

    if (viewMode === 'all') {
      return { type: 'all', notes };
    }

    return { type: 'grouped', data: groupedNotes };
  };

  const displayData = getDisplayNotes();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-[#D97706] dark:text-amber-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('journal.title')}</h2>
            {noteStats && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('journal.noteStats', {
                  notes: t('journal.noteWord', { count: noteStats.total_notes }),
                  pins: t('journal.pinnedWord', { count: noteStats.pinned_notes }),
                })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('journal.exportToMarkdown')}
          >
            <FileDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3 flex-shrink-0">
        {/* Search */}
        <div className="relative">
          <MagnifierIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('journal.searchNotes')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'grouped'
                ? 'bg-amber-100 dark:bg-amber-900/30 text-[#D97706] dark:text-amber-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <MapPin className="w-4 h-4 inline mr-1" />
            {t('journal.byDestination')}
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'all'
                ? 'bg-amber-100 dark:bg-amber-900/30 text-[#D97706] dark:text-amber-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-1" />
            {t('common.all')}
          </button>
          <button
            onClick={() => setViewMode('pinned')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'pinned'
                ? 'bg-amber-100 dark:bg-amber-900/30 text-[#D97706] dark:text-amber-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Pin className="w-4 h-4 inline mr-1" />
            {t('journal.pinned')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner />
          </div>
        ) : displayData.type === 'search' || displayData.type === 'all' || displayData.type === 'pinned' ? (
          // Flat list view
          <div className="space-y-3">
            {displayData.notes.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                {displayData.type === 'search' ? (
                  <>{t('journal.noNotesFound', { query: searchQuery })}</>
                ) : displayData.type === 'pinned' ? (
                  <>{t('journal.noPinnedNotes')}</>
                ) : (
                  <>{t('journal.startWriting')}</>
                )}
              </div>
            ) : (
              displayData.notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={handleEdit}
                  onDelete={handleDeleteNote}
                  onTogglePin={handleTogglePin}
                  onClick={handleNoteClick}
                />
              ))
            )}
          </div>
        ) : (
          // Grouped view
          <div className="space-y-4">
            {/* Trip-level notes */}
            {groupedNotes?.trip_level?.length > 0 && (
              <div>
                <div
                  className="flex items-center gap-2 mb-2 cursor-pointer"
                  onClick={() => toggleDestination('trip')}
                >
                  {expandedDestinations['trip'] ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">
                    {t('journal.tripNotes')}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({groupedNotes.trip_level.length})
                  </span>
                </div>
                {expandedDestinations['trip'] && (
                  <div className="space-y-2 ml-6">
                    {groupedNotes.trip_level.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        compact
                        onEdit={handleEdit}
                        onDelete={handleDeleteNote}
                        onTogglePin={handleTogglePin}
                        onClick={handleNoteClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Destination notes */}
            {groupedNotes?.by_destination?.map((destGroup) => (
              <div key={destGroup.destination_id}>
                <div
                  className="flex items-center gap-2 mb-2 cursor-pointer"
                  onClick={() => toggleDestination(destGroup.destination_id)}
                >
                  {expandedDestinations[destGroup.destination_id] ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <MapPin className="w-4 h-4 text-[#D97706]" />
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">
                    {destGroup.destination_name}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({destGroup.count})
                  </span>
                </div>
                {expandedDestinations[destGroup.destination_id] && destGroup.notes.length > 0 && (
                  <div className="space-y-2 ml-6">
                    {destGroup.notes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        compact
                        onEdit={handleEdit}
                        onDelete={handleDeleteNote}
                        onTogglePin={handleTogglePin}
                        onClick={handleNoteClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Empty state */}
            {(!groupedNotes || (groupedNotes.trip_level.length === 0 && groupedNotes.by_destination.every(d => d.count === 0))) && (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('journal.noNotes')}</p>
                <p className="text-sm">{t('journal.startDocumenting')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Note Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <button
          onClick={() => {
            setEditingNote(null);
            setShowNoteModal(true);
          }}
          className="w-full py-3 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {t('journal.addNote')}
        </button>
      </div>

      {/* Note Form Modal */}
      <NoteFormModal
        isOpen={showNoteModal}
        onClose={() => {
          setShowNoteModal(false);
          setEditingNote(null);
        }}
        onSubmit={editingNote ? handleUpdateNote : handleCreateNote}
        note={editingNote}
        tripId={tripId}
        destinations={destinations}
        pois={pois.flatMap(group => group.pois || [])}
        isSaving={isSaving}
      />

      {/* Note Detail Modal */}
      <NoteDetailModal
        isOpen={!!selectedNote}
        onClose={() => setSelectedNote(null)}
        note={selectedNote}
        onEdit={handleEdit}
        onDelete={handleDeleteNote}
        onTogglePin={handleTogglePin}
      />
    </div>
  );
};

export default Journal;
