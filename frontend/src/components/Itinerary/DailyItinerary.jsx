import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  GripVertical,
  Landmark,
  UtensilsCrossed,
  Mountain,
  TreePine,
  ShoppingBag,
  Music,
  Camera,
  MapPin,
  Calendar,
  Pencil,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Footprints,
  Bike,
  Car,
  ArrowDown,
  Route,
  Loader2,
  AlertCircle,
  Plus,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import useDayRoutesStore from '../../stores/useDayRoutesStore';
import usePOIStore from '../../stores/usePOIStore';
import { formatDateWithWeekday, formatDateRangeShort } from '../../utils/dateFormat';

// Lazy load heavy modal components
const OptimizationPreview = lazy(() => import('../Agenda/OptimizationPreview'));
const POISuggestionsModal = lazy(() => import('../POI/POISuggestionsModal'));

// Category icon mapping
const categoryIcons = {
  'Sights': Landmark,
  'Museums': Landmark,
  'Food': UtensilsCrossed,
  'Restaurants': UtensilsCrossed,
  'Viewpoints': Mountain,
  'Nature': TreePine,
  'Shopping': ShoppingBag,
  'Entertainment': Music,
  'Photography': Camera,
  'Accommodation': MapPin,
  'Activity': MapPin,
  'Museum': Landmark,
};

// Category color mapping
const categoryColors = {
  'Sights': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Museums': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Food': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Restaurants': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Viewpoints': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Nature': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Shopping': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'Entertainment': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Photography': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Accommodation': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Activity': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Museum': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

// Format minutes to hours and minutes
const formatDwellTime = (minutes) => {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Transport mode options for segment routing
const TRANSPORT_MODES = [
  { id: 'walking', label: 'Walk', icon: Footprints, color: 'text-green-600 bg-green-50' },
  { id: 'cycling', label: 'Bike', icon: Bike, color: 'text-amber-600 bg-amber-50' },
  { id: 'driving', label: 'Drive', icon: Car, color: 'text-indigo-600 bg-indigo-50' },
];

// Transport Mode Connector between POIs - memoized to prevent re-renders
const TransportModeConnector = React.memo(function TransportModeConnector({ fromPoiId, toPoiId, segment }) {
  const { getSegmentMode, setSegmentMode } = useDayRoutesStore();
  const currentMode = getSegmentMode(fromPoiId, toPoiId);

  const handleModeChange = (mode) => {
    setSegmentMode(fromPoiId, toPoiId, mode);
  };

  // Format segment info
  const formatDistance = (km) => {
    if (!km) return '';
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
  };

  const formatDuration = (min) => {
    if (!min) return '';
    return min < 60 ? `${Math.round(min)}min` : `${Math.floor(min / 60)}h${Math.round(min % 60)}m`;
  };

  return (
    <div className="flex items-center justify-center py-1.5 px-2">
      <div className="flex items-center gap-2">
        {/* Connector line */}
        <div className="flex flex-col items-center">
          <ArrowDown className="w-3 h-3 text-gray-300" />
        </div>

        {/* Transport mode buttons */}
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-full p-0.5">
          {TRANSPORT_MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                className={`p-1 rounded-full transition-all duration-150 ${
                  isSelected
                    ? mode.color
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title={mode.label}
              >
                <Icon className="w-3 h-3" />
              </button>
            );
          })}
        </div>

        {/* Segment stats (if available) */}
        {segment && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatDistance(segment.distance)} · {formatDuration(segment.duration)}
          </span>
        )}
      </div>
    </div>
  );
});

// Generate days between arrival and departure
const generateDays = (arrivalDate, departureDate) => {
  if (!arrivalDate || !departureDate) return [];

  const days = [];
  const arrival = new Date(arrivalDate);
  const departure = new Date(departureDate);

  let currentDate = new Date(arrival);
  let dayNumber = 1;

  while (currentDate < departure) {
    days.push({
      dayNumber,
      date: currentDate.toISOString().split('T')[0],
      displayDate: formatDateWithWeekday(currentDate),
    });
    currentDate.setDate(currentDate.getDate() + 1);
    dayNumber++;
  }

  return days;
};

// Sortable POI Item
const SortablePOIItem = ({ poi, isOverlay = false, onEdit, onDelete, onVote, onClick, onAddNote, noteCount = 0 }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: poi.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const CategoryIcon = categoryIcons[poi.category] || MapPin;
  const score = (poi.likes || 0) - (poi.vetoes || 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center p-2 rounded-lg bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        ${isDragging ? 'shadow-lg ring-2 ring-indigo-500' : 'shadow-sm'}
        ${isOverlay ? 'shadow-xl' : ''}
        transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50
      `}
      onClick={() => onClick && onClick(poi)}
    >
      <button
        className="p-1 mr-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {poi.name}
          </span>
          <div className="flex items-center space-x-1 ml-2" onClick={(e) => e.stopPropagation()}>
            {onVote && (
              <>
                <button
                  onClick={() => onVote(poi.id, 'like')}
                  className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                >
                  <ThumbsUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                </button>
                <button
                  onClick={() => onVote(poi.id, 'veto')}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                >
                  <ThumbsDown className="w-3 h-3 text-red-600 dark:text-red-400" />
                </button>
              </>
            )}
            {onAddNote && (
              <button
                onClick={() => onAddNote(poi)}
                className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors relative"
                title="Add note for this POI"
              >
                <BookOpen className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                {noteCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {noteCount > 9 ? '9+' : noteCount}
                  </span>
                )}
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(poi)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <Pencil className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(poi)}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3 text-red-500 dark:text-red-400" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center mt-1 gap-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded flex items-center ${categoryColors[poi.category] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
            <CategoryIcon className="w-3 h-3 mr-1" />
            {poi.category}
          </span>
          {poi.dwell_time && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formatDwellTime(poi.dwell_time)}
            </span>
          )}
          {(poi.likes > 0 || poi.vetoes > 0) && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              score > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              score < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {score > 0 ? '+' : ''}{score}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Droppable container component
const DroppableContainer = ({ id, children, className = '' }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-2 ring-indigo-500 ring-opacity-50 bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
    >
      {typeof children === 'function' ? children(isOver) : children}
    </div>
  );
};

// Droppable Day Column - memoized to prevent re-renders when other days change
const DayColumn = React.memo(function DayColumn({
  day,
  pois,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onVote,
  onPOIClick,
  totalDwellTime,
  onOptimize,
  isOptimizing,
  onAddDayNote,
  onAddPOINote,
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50">
        <button
          onClick={onToggle}
          className="flex items-center flex-1 hover:bg-gray-100 dark:hover:bg-gray-700 -m-1 p-1 rounded transition-colors"
        >
          <Calendar className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400" />
          <span className="font-medium text-sm text-gray-900 dark:text-white">
            Day {day.dayNumber}
          </span>
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            {day.displayDate}
          </span>
          {pois.length > 0 && (
            <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">
              {pois.length}
            </span>
          )}
        </button>
        <div className="flex items-center space-x-2">
          {/* Add Note Button */}
          {onAddDayNote && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddDayNote(day.dayNumber, day.date);
              }}
              className="p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors"
              title="Add note for this day"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Optimize Route Button */}
          {pois.length >= 2 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOptimize?.(day.dayNumber);
              }}
              disabled={isOptimizing}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors disabled:opacity-50"
              title="Optimize route order"
            >
              {isOptimizing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Route className="w-3 h-3" />
              )}
              <span>Optimize</span>
            </button>
          )}
          {totalDwellTime > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formatDwellTime(totalDwellTime)}
            </span>
          )}
          <button onClick={onToggle} className="p-1">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <DroppableContainer id={day.date} className="p-2 min-h-[60px] transition-all">
          {(isOver) => (
            <SortableContext
              items={pois.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {pois.length === 0 ? (
                <div className={`
                  flex flex-col items-center justify-center py-8 px-4
                  border-2 border-dashed rounded-xl transition-all duration-300 ease-out
                  ${isOver
                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/30 dark:to-indigo-800/20 scale-[1.02] shadow-inner'
                    : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }
                `}>
                  {/* Animated icon container */}
                  <div className={`
                    relative p-3 rounded-xl mb-3 transition-all duration-300
                    ${isOver
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 shadow-md'
                      : 'bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 text-gray-400 dark:text-gray-500'
                    }
                  `}>
                    <Calendar className={`w-6 h-6 transition-transform duration-300 ${isOver ? 'scale-110' : ''}`} />
                    {/* Decorative ring on hover/drag */}
                    {isOver && (
                      <div className="absolute inset-0 rounded-xl border-2 border-indigo-400/50 animate-ping" />
                    )}
                  </div>

                  <span className={`text-sm font-medium transition-colors duration-200 ${isOver ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-300'}`}>
                    {isOver ? 'Release to schedule' : 'Plan your day'}
                  </span>

                  <span className={`text-xs mt-1.5 text-center transition-colors duration-200 max-w-[160px] ${isOver ? 'text-indigo-600/80 dark:text-indigo-400/80' : 'text-gray-400 dark:text-gray-500'}`}>
                    {isOver ? 'Adding to this day\'s itinerary' : 'Drag places here to add them to this day'}
                  </span>

                  {/* Visual hint arrows */}
                  {!isOver && (
                    <div className="mt-3 flex items-center space-x-1 text-gray-300 dark:text-gray-600">
                      <ArrowDown className="w-3 h-3 animate-bounce" style={{ animationDelay: '0s' }} />
                      <ArrowDown className="w-3 h-3 animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <ArrowDown className="w-3 h-3 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  )}
                </div>
              ) : (
                pois.map((poi, index) => (
                  <React.Fragment key={poi.id}>
                    <SortablePOIItem
                      poi={poi}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onVote={onVote}
                      onClick={onPOIClick}
                      onAddNote={onAddPOINote ? () => onAddPOINote(poi) : null}
                    />
                    {/* Transport mode connector between POIs */}
                    {index < pois.length - 1 && (
                      <TransportModeConnector
                        fromPoiId={poi.id}
                        toPoiId={pois[index + 1].id}
                      />
                    )}
                  </React.Fragment>
                ))
              )}
            </SortableContext>
          )}
        </DroppableContainer>
      )}
    </div>
  );
});

// Unscheduled POIs Section - memoized to prevent re-renders when days change
const UnscheduledSection = React.memo(function UnscheduledSection({ pois, isExpanded, onToggle, onEdit, onDelete, onVote, onPOIClick, onAddPOINote }) {
  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center">
          <MapPin className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
            Unscheduled
          </span>
          {pois.length > 0 && (
            <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
              {pois.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <DroppableContainer id="unscheduled" className="p-2 min-h-[60px] space-y-2 transition-all">
          <SortableContext
            items={pois.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {pois.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <div className="p-2.5 rounded-full bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/30 dark:to-emerald-800/20 mb-3">
                  <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  All set!
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  Every place has been scheduled
                </span>
              </div>
            ) : (
              pois.map((poi) => (
                <SortablePOIItem
                  key={poi.id}
                  poi={poi}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onVote={onVote}
                  onClick={onPOIClick}
                  onAddNote={onAddPOINote ? () => onAddPOINote(poi) : null}
                />
              ))
            )}
          </SortableContext>
        </DroppableContainer>
      )}
    </div>
  );
});

// Main Component
const DailyItinerary = ({
  destination,
  pois = [],
  onScheduleChange,
  onBack,
  onEditPOI,
  onDeletePOI,
  onVotePOI,
  onPOIClick,
  onAddDayNote,
  onAddPOINote,
  className = '',
  showHeader = true,
}) => {
  const [expandedDays, setExpandedDays] = useState({});
  const [unscheduledExpanded, setUnscheduledExpanded] = useState(true);
  const [activePOI, setActivePOI] = useState(null);

  // Optimization state
  const [showOptimizationPreview, setShowOptimizationPreview] = useState(false);
  const [optimizingDay, setOptimizingDay] = useState(null);
  const [isApplyingOptimization, setIsApplyingOptimization] = useState(false);
  const [startLocationInfo, setStartLocationInfo] = useState(null);
  const [optimizationError, setOptimizationError] = useState(null);
  const [startTime, setStartTime] = useState('08:00');

  // POI Suggestions state
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

  // Store actions for optimization
  const {
    optimizationResult,
    isOptimizing,
    getAccommodationForDay,
    optimizeDayRoute,
    applyOptimizedOrder,
    clearOptimizationResult,
  } = usePOIStore();

  // Flatten POIs from category groups
  const allPOIs = useMemo(() => {
    if (!pois || !Array.isArray(pois)) return [];
    return pois.flatMap((group) => group.pois || []);
  }, [pois]);

  // Generate days for the destination
  const days = useMemo(() => {
    if (!destination?.arrival_date || !destination?.departure_date) return [];
    return generateDays(destination.arrival_date, destination.departure_date);
  }, [destination?.arrival_date, destination?.departure_date]);

  // Initialize expanded state for all days - use useEffect for state updates
  useEffect(() => {
    if (days.length > 0 && Object.keys(expandedDays).length === 0) {
      const initial = {};
      days.forEach((day) => {
        initial[day.date] = true;
      });
      setExpandedDays(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Organize POIs by scheduled date
  const { scheduledByDay, unscheduled } = useMemo(() => {
    const scheduled = {};
    const unscheduledList = [];

    days.forEach((day) => {
      scheduled[day.date] = [];
    });

    allPOIs.forEach((poi) => {
      if (poi.scheduled_date && scheduled[poi.scheduled_date]) {
        scheduled[poi.scheduled_date].push(poi);
      } else {
        unscheduledList.push(poi);
      }
    });

    // Sort each day's POIs by day_order
    Object.keys(scheduled).forEach((date) => {
      scheduled[date].sort((a, b) => (a.day_order || 0) - (b.day_order || 0));
    });

    return { scheduledByDay: scheduled, unscheduled: unscheduledList };
  }, [allPOIs, days]);

  // Calculate total dwell time per day
  const dwellTimeByDay = useMemo(() => {
    const times = {};
    Object.entries(scheduledByDay).forEach(([date, dayPOIs]) => {
      times[date] = dayPOIs.reduce((total, poi) => total + (poi.dwell_time || 0), 0);
    });
    return times;
  }, [scheduledByDay]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Find which container a POI belongs to - memoized to avoid recreating on every render
  const findContainer = useCallback((poiId) => {
    // Check unscheduled
    if (unscheduled.find(p => p.id === poiId)) {
      return 'unscheduled';
    }
    // Check each day
    for (const [date, dayPOIs] of Object.entries(scheduledByDay)) {
      if (dayPOIs.find(p => p.id === poiId)) {
        return date;
      }
    }
    return null;
  }, [unscheduled, scheduledByDay]);

  // Handle drag start
  const handleDragStart = (event) => {
    const { active } = event;
    const poi = allPOIs.find(p => p.id === active.id);
    setActivePOI(poi);
  };

  // Handle drag over (for moving between containers)
  const handleDragOver = (event) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeContainer = findContainer(activeId);
    let overContainer = findContainer(overId);

    // If overId is not a POI, check if it's a droppable container
    if (!overContainer) {
      if (overId === 'unscheduled') {
        overContainer = 'unscheduled';
      } else if (scheduledByDay[overId] !== undefined) {
        overContainer = overId;
      }
    }

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }
  };

  // Handle drag end
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActivePOI(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find which container the active item is in
    const activeContainer = findContainer(activeId);

    // Determine target container - could be a POI id or a droppable container id
    let overContainer = findContainer(overId);

    // If overId is not a POI, it might be a droppable container id (date string or 'unscheduled')
    if (!overContainer) {
      // Check if it's a valid day date or unscheduled
      if (overId === 'unscheduled') {
        overContainer = 'unscheduled';
      } else if (scheduledByDay[overId] !== undefined) {
        // It's a date string that matches one of our day containers
        overContainer = overId;
      }
    }

    if (!activeContainer || !overContainer) return;

    // Get the source and target arrays (make copies)
    const sourceItems = activeContainer === 'unscheduled'
      ? [...unscheduled]
      : [...(scheduledByDay[activeContainer] || [])];

    const targetItems = overContainer === 'unscheduled'
      ? [...unscheduled]
      : [...(scheduledByDay[overContainer] || [])];

    const activeIndex = sourceItems.findIndex(p => p.id === activeId);

    if (activeIndex === -1) return;

    const movedPOI = sourceItems[activeIndex];
    const updates = [];

    if (activeContainer === overContainer) {
      // Reordering within same container
      let overIndex = targetItems.findIndex(p => p.id === overId);

      // If overId is the container ID (not a POI ID), overIndex will be -1
      // In this case, we're dropping into an empty area of the container
      // or the overId is the container itself - skip if no valid target
      if (overIndex === -1) {
        // Check if overId is a container ID - if so, place at end of container
        if (overId === activeContainer || overId === 'unscheduled' || scheduledByDay[overId] !== undefined) {
          // Dropping onto the container itself - no reorder needed within same container
          return;
        }
        return;
      }

      if (activeIndex === overIndex) return;

      // Use arrayMove for proper reordering
      const reorderedItems = arrayMove(targetItems, activeIndex, overIndex);

      // Create updates for all items in this container
      reorderedItems.forEach((poi, index) => {
        updates.push({
          id: poi.id,
          scheduled_date: activeContainer === 'unscheduled' ? null : activeContainer,
          day_order: index,
        });
      });
    } else {
      // Moving between containers
      // Remove from source
      sourceItems.splice(activeIndex, 1);

      // Find insert position in target
      let insertIndex = targetItems.length;
      const overIndex = targetItems.findIndex(p => p.id === overId);
      if (overIndex !== -1) {
        insertIndex = overIndex;
      }

      // Insert into target
      targetItems.splice(insertIndex, 0, movedPOI);

      // Update source container orders
      sourceItems.forEach((poi, index) => {
        updates.push({
          id: poi.id,
          scheduled_date: activeContainer === 'unscheduled' ? null : activeContainer,
          day_order: index,
        });
      });

      // Update target container orders
      targetItems.forEach((poi, index) => {
        updates.push({
          id: poi.id,
          scheduled_date: overContainer === 'unscheduled' ? null : overContainer,
          day_order: index,
        });
      });
    }

    // Call the schedule change handler
    if (onScheduleChange && updates.length > 0) {
      onScheduleChange(updates);
    }
  };

  const toggleDay = (date) => {
    setExpandedDays((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };


  // Optimization handlers
  const handleOptimizeDay = useCallback(async (dayNumber) => {
    const day = days.find(d => d.dayNumber === dayNumber);
    if (!day) return;

    const dayPOIs = scheduledByDay[day.date] || [];
    if (dayPOIs.length < 2) {
      setOptimizationError('Need at least 2 POIs to optimize');
      setTimeout(() => setOptimizationError(null), 3000);
      return;
    }

    setOptimizingDay(dayNumber);
    setOptimizationError(null);

    try {
      // First, get the accommodation/start location for this day
      const locationInfo = await getAccommodationForDay(destination.id, dayNumber);
      setStartLocationInfo(locationInfo);

      // Then optimize the route with start time
      await optimizeDayRoute(
        destination.id,
        dayNumber,
        locationInfo.start_location,
        startTime
      );

      // Show preview modal
      setShowOptimizationPreview(true);
    } catch (error) {
      setOptimizationError(error.message);
      setTimeout(() => setOptimizationError(null), 5000);
    }
  }, [destination?.id, days, scheduledByDay, getAccommodationForDay, optimizeDayRoute, startTime]);

  const handleApplyOptimization = useCallback(async () => {
    if (!optimizationResult || !destination || optimizingDay === null) return;

    setIsApplyingOptimization(true);

    try {
      // Find the date for this day number
      const day = days.find(d => d.dayNumber === optimizingDay);
      if (!day) {
        throw new Error('Day not found');
      }

      await applyOptimizedOrder(
        destination.id,
        optimizationResult.optimized_order,
        day.date
      );

      setShowOptimizationPreview(false);
      setOptimizingDay(null);
    } catch (error) {
      setOptimizationError(error.message);
    } finally {
      setIsApplyingOptimization(false);
    }
  }, [destination, optimizingDay, optimizationResult, days, applyOptimizedOrder]);

  const handleCloseOptimizationPreview = useCallback(() => {
    setShowOptimizationPreview(false);
    setOptimizingDay(null);
    clearOptimizationResult();
  }, [clearOptimizationResult]);

  const handleStartTimeChange = useCallback(async (newTime) => {
    setStartTime(newTime);
    if (showOptimizationPreview && startLocationInfo && optimizingDay) {
      try {
        await optimizeDayRoute(
          destination.id,
          optimizingDay,
          startLocationInfo.start_location,
          newTime
        );
      } catch (error) {
        setOptimizationError(error.message);
      }
    }
  }, [showOptimizationPreview, startLocationInfo, optimizingDay, destination?.id, optimizeDayRoute]);

  if (!destination) {
    return (
      <div className={`flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-80 ${className}`}>
        <div className="p-4 text-gray-500 dark:text-gray-400">No destination selected</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to route
            </button>
          )}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {destination.name || destination.city_name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDateRangeShort(destination.arrival_date, destination.departure_date)}
          </p>
          <div className="flex items-center mt-2 justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                {days.length} {days.length === 1 ? 'day' : 'days'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {allPOIs.length} POI{allPOIs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => setShowSuggestionsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg transition-all shadow-sm hover:shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discover POIs</span>
            </button>
          </div>
        </div>
      )}

      {/* Itinerary Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Day Columns */}
          {days.map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              pois={scheduledByDay[day.date] || []}
              isExpanded={expandedDays[day.date] !== false}
              onToggle={() => toggleDay(day.date)}
              onEdit={onEditPOI}
              onDelete={onDeletePOI}
              onVote={onVotePOI}
              onPOIClick={onPOIClick}
              totalDwellTime={dwellTimeByDay[day.date] || 0}
              onOptimize={handleOptimizeDay}
              isOptimizing={optimizingDay === day.dayNumber && isOptimizing}
              onAddDayNote={onAddDayNote}
              onAddPOINote={onAddPOINote}
            />
          ))}

          {/* Unscheduled Section */}
          <UnscheduledSection
            pois={unscheduled}
            isExpanded={unscheduledExpanded}
            onToggle={() => setUnscheduledExpanded(!unscheduledExpanded)}
            onEdit={onEditPOI}
            onDelete={onDeletePOI}
            onVote={onVotePOI}
            onPOIClick={onPOIClick}
            onAddPOINote={onAddPOINote}
          />

          {/* Drag Overlay */}
          <DragOverlay>
            {activePOI ? (
              <SortablePOIItem poi={activePOI} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Footer Summary */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            Scheduled: <span className="font-medium text-indigo-600 dark:text-indigo-400">{allPOIs.length - unscheduled.length}</span>
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            Unscheduled: <span className="font-medium text-gray-700 dark:text-gray-300">{unscheduled.length}</span>
          </span>
        </div>
      </div>

      {/* Optimization Error Toast */}
      {optimizationError && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg shadow-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{optimizationError}</span>
        </div>
      )}

      {/* Optimization Preview Modal - Lazy loaded */}
      <Suspense fallback={null}>
        {showOptimizationPreview && (
          <OptimizationPreview
            isOpen={showOptimizationPreview}
            onClose={handleCloseOptimizationPreview}
            onApply={handleApplyOptimization}
            optimizationResult={optimizationResult}
            isApplying={isApplyingOptimization}
            dayNumber={optimizingDay}
            startLocationName={
              startLocationInfo?.accommodation?.name ||
              (startLocationInfo?.warning ? 'City center (no accommodation set)' : null)
            }
            startTime={startTime}
            onStartTimeChange={handleStartTimeChange}
          />
        )}
      </Suspense>

      {/* POI Suggestions Modal - Lazy loaded */}
      <Suspense fallback={null}>
        {showSuggestionsModal && (
          <POISuggestionsModal
            isOpen={showSuggestionsModal}
            onClose={() => setShowSuggestionsModal(false)}
            destinationId={destination?.id}
            destinationName={destination?.name || destination?.city_name}
          />
        )}
      </Suspense>
    </div>
  );
};

export default DailyItinerary;
