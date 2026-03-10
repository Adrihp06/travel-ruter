/**
 * Travel Context Panel — read-only reference showing POIs and accommodations
 * for the selected document's destination (or trip overview).
 *
 * Features:
 * - POI descriptions are expandable/collapsible on demand
 * - Day-grouped schedule view when schedule data is available
 * - Per-POI "Prepare Prompt" action that composes a rich AI prompt
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin, Bed, ChevronDown, ChevronRight, Globe, Loader2,
  Sparkles, Calendar, Route, Map,
} from 'lucide-react';
import usePOIStore, { usePOIsByCategory, usePOIsLoading } from '../../stores/usePOIStore';
import useAccommodationStore from '../../stores/useAccommodationStore';
import useDayRoutesStore from '../../stores/useDayRoutesStore';
import useExportWriterStore from '../../stores/useExportWriterStore';
import { composePOIPrompt, formatCurrency } from './promptComposer';

function hasRouteCoordinates(poi) {
  return Number.isFinite(poi?.latitude) && Number.isFinite(poi?.longitude);
}

const CATEGORY_ICONS = {
  attraction: '🏛️',
  restaurant: '🍽️',
  cafe: '☕',
  shopping: '🛍️',
  nightlife: '🌙',
  nature: '🌿',
  culture: '🎭',
  transport: '🚌',
};

function CollapsibleSection({ title, icon, count, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        )}
        {icon}
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200 flex-1">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>
      {isOpen && <div className="px-3 py-2">{children}</div>}
    </div>
  );
}

/**
 * A single POI card with expandable description and a "Prepare Prompt" action.
 */
function ExpandablePOICard({ poi, onPreparePrompt, prepareDisabled = false, t }) {
  const [expanded, setExpanded] = useState(false);
  const hasLongDesc = poi.description && poi.description.length > 60;

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 group">
      <MapPin className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate flex-1">
            {poi.name}
          </span>
          {onPreparePrompt && (
            <button
              onClick={(e) => { e.stopPropagation(); if (!prepareDisabled) onPreparePrompt(poi); }}
              title={t('exportWriter.travelData.preparePoiPrompt')}
              disabled={prepareDisabled}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0 p-0.5 rounded text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3 h-3" />
            </button>
          )}
        </div>
        {poi.description && (
          <div
            className={`text-[10px] text-gray-400 dark:text-gray-500 ${
              !expanded && hasLongDesc ? 'line-clamp-2' : ''
            }`}
          >
            {poi.description}
          </div>
        )}
        {hasLongDesc && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline mt-0.5"
          >
            {expanded ? t('exportWriter.travelData.showLess') : t('exportWriter.travelData.showMore')}
          </button>
        )}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {poi.estimated_cost != null && poi.estimated_cost > 0 && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              ~{formatCurrency(poi.estimated_cost, poi.currency)}
            </span>
          )}
          {poi.dwell_time != null && poi.dwell_time > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {t('exportWriter.travelData.minutes', { count: poi.dwell_time })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function POICategoryGroup({ category, poiList, onPreparePrompt, prepareDisabled, t }) {
  const icon = CATEGORY_ICONS[category?.toLowerCase()] || '📍';

  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
        {icon} {category}
      </div>
      <div className="space-y-1">
        {poiList.map((poi) => (
          <ExpandablePOICard
            key={poi.id}
            poi={poi}
            onPreparePrompt={onPreparePrompt}
            prepareDisabled={prepareDisabled}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Day-based schedule group — shows POIs organized by their scheduled date
 * with route segment info when available.
 */
function DayScheduleGroup({ date, pois, dayRoute, onPreparePrompt, onInsertDayRoute, prepareDisabled, destinationId, t }) {
  const dateLabel = (() => {
    try {
      return new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
      });
    } catch {
      return date;
    }
  })();

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Calendar className="w-3 h-3 text-amber-500 flex-shrink-0" />
        <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
          {dateLabel}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          ({t('exportWriter.travelData.stopCount', { count: pois.length })})
        </span>
      </div>
      {dayRoute && dayRoute.totalDistance > 0 && (
        <div className="flex items-center gap-2 mb-1 ml-4">
          <Route className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {t('exportWriter.travelData.routeSummary', {
              distance: dayRoute.totalDistance.toFixed(1),
              duration: Math.round(dayRoute.totalDuration || 0),
            })}
          </span>
        </div>
      )}
      {onInsertDayRoute && destinationId && (
        <button
          onClick={() => onInsertDayRoute({ destinationId, date, label: `${dateLabel} Route` })}
          className="flex items-center gap-1 ml-4 mb-1 px-2 py-1 rounded text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          title={t('exportWriter.travelData.insertDayRoute')}
          data-testid={`insert-day-route-${date}`}
        >
          <Map className="w-2.5 h-2.5" />
          {t('exportWriter.travelData.insertDayRoute')}
        </button>
      )}
        <div className="space-y-1">
          {pois.map((poi) => (
            <ExpandablePOICard
              key={poi.id}
              poi={poi}
              onPreparePrompt={onPreparePrompt}
              prepareDisabled={prepareDisabled}
              t={t}
            />
          ))}
        </div>
      </div>
  );
}

function AccommodationCard({ acc }) {
  const dates = [acc.check_in_date, acc.check_out_date].filter(Boolean).join(' → ');

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
      <Bed className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
          {acc.name}
        </div>
        {dates && (
          <div className="text-[10px] text-gray-400 dark:text-gray-500">{dates}</div>
        )}
        {acc.address && (
          <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{acc.address}</div>
        )}
        {acc.price_per_night != null && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">
            {acc.price_per_night}€/night
          </span>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, t }) {
  const preview = (note.content || '').replace(/\s+/g, ' ').trim();

  return (
    <div className="px-2 py-1.5 rounded bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
        {note.title || t('common.note')}
      </div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
        {preview || t('journal.noContent')}
      </div>
    </div>
  );
}

const TravelContextPanel = ({ trip, destinations, onPreparePrompt, onInsertDayRoute }) => {
  const { t, i18n } = useTranslation();
  const selectedDocId = useExportWriterStore((s) => s.selectedDocId);
  const documents = useExportWriterStore((s) => s.documents);
  const referenceNotes = useExportWriterStore((s) => s.referenceNotes);
  const selectedDoc = selectedDocId
    ? (documents[selectedDocId] || referenceNotes?.[selectedDocId] || null)
    : null;

  const pois = usePOIsByCategory();
  const poisLoading = usePOIsLoading();
  const clearPOIs = usePOIStore((s) => s.clearPOIs);
  const fetchPOIsByDestination = usePOIStore((s) => s.fetchPOIsByDestination);
  const getPOIsBySchedule = usePOIStore((s) => s.getPOIsBySchedule);
  const accommodations = useAccommodationStore((s) => s.accommodations);
  const accLoading = useAccommodationStore((s) => s.isLoading);
  const clearAccommodations = useAccommodationStore((s) => s.clearAccommodations);
  const fetchAccommodations = useAccommodationStore((s) => s.fetchAccommodations);
  const dayRoutes = useDayRoutesStore((s) => s.dayRoutes);
  const calculateAllDayRoutesImmediate = useDayRoutesStore((s) => s.calculateAllDayRoutesImmediate);
  const clearRoutes = useDayRoutesStore((s) => s.clearRoutes);
  const isRouteCalculating = useDayRoutesStore((s) => s.isCalculating);

  const lastFetchedDestIdRef = useRef(null);

  // Toggle between "by category" and "by day" views
  const [viewMode, setViewMode] = useState('category');

  const destinationId = selectedDoc?.destinationId || null;
  const destination = destinationId
    ? destinations?.find((d) => d.id === destinationId)
    : null;
  const destinationNotes = useMemo(
    () => Object.values(referenceNotes || {}).filter((note) => note.destinationId === destinationId),
    [referenceNotes, destinationId]
  );

  // Fetch data when destination changes (parallel)
  useEffect(() => {
    if (!destinationId) {
      lastFetchedDestIdRef.current = null;
      clearPOIs?.();
      clearAccommodations?.();
      clearRoutes?.();
      return;
    }

    if (destinationId !== lastFetchedDestIdRef.current) {
      lastFetchedDestIdRef.current = destinationId;
      clearPOIs?.();
      clearAccommodations?.();
      clearRoutes?.();
      Promise.all([
        fetchPOIsByDestination(destinationId),
        fetchAccommodations(destinationId),
      ]);
    }
  }, [destinationId, clearPOIs, clearAccommodations, clearRoutes, fetchPOIsByDestination, fetchAccommodations]);

  // Build schedule view from POI store data
  const scheduleData = useMemo(() => {
    if (!getPOIsBySchedule) return null;
    try {
      return getPOIsBySchedule();
    } catch {
      return null;
    }
  }, [getPOIsBySchedule]);

  const hasScheduledPOIs = scheduleData?.scheduled && Object.keys(scheduleData.scheduled).length > 0;
  const activeViewMode = hasScheduledPOIs ? viewMode : 'category';

  useEffect(() => {
    if (!destinationId) {
      clearRoutes?.();
      return;
    }

    if (poisLoading) {
      return;
    }

    const scheduledByDay = scheduleData?.scheduled || {};
    const routableSchedule = Object.fromEntries(
      Object.entries(scheduledByDay)
        .map(([date, dayPois]) => [date, dayPois.filter(hasRouteCoordinates)])
        .filter(([, dayPois]) => dayPois.length > 1)
    );

    if (Object.keys(routableSchedule).length === 0) {
      clearRoutes?.();
      return;
    }

    calculateAllDayRoutesImmediate?.(routableSchedule);
  }, [destinationId, scheduleData, poisLoading, calculateAllDayRoutesImmediate, clearRoutes]);

  useEffect(() => () => {
    clearRoutes?.();
  }, [clearRoutes]);

  // Compose a per-POI prompt using available day route data
  const handlePreparePrompt = (poi) => {
    const scheduledPois = poi.scheduled_date ? scheduleData?.scheduled?.[poi.scheduled_date] || [] : [];
    const routedDayRoute = poi.scheduled_date ? dayRoutes[poi.scheduled_date] : null;
    const dayRoute = poi.scheduled_date
      ? ({
          ...(routedDayRoute || {}),
          itineraryPois: scheduledPois,
          pois: routedDayRoute?.pois || scheduledPois,
        })
      : null;
    const prompt = composePOIPrompt({
      poi,
      destination,
      dayRoute: dayRoute || null,
      accommodations,
      trip,
      language: i18n.language,
    });
    if (onPreparePrompt) {
      onPreparePrompt({
        prompt,
        label: t('exportWriter.writer.poiModeLabel', { name: poi.name }),
      });
    }
  };

  const isLoading = poisLoading || accLoading;
  const isPromptContextLoading = isLoading || isRouteCalculating;
  const totalPOIs = pois.reduce((sum, group) => sum + group.pois.length, 0);

  // Trip Overview mode: show all destinations summary
  if (!destinationId) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-gray-900">
          <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('exportWriter.travelData.tripOverview')}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {trip && (
            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <div className="font-medium text-gray-800 dark:text-gray-100">{trip.name}</div>
              {trip.start_date && trip.end_date && (
                <div className="text-gray-400 dark:text-gray-500">
                  {trip.start_date} → {trip.end_date}
                </div>
              )}
              {trip.description && <div>{trip.description}</div>}
            </div>
          )}

          <CollapsibleSection
            title={t('trips.destinations')}
            icon={<MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            count={destinations?.length || 0}
          >
            <div className="space-y-2">
              {(destinations || []).map((dest) => (
                <div
                  key={dest.id}
                  className="px-2 py-1.5 rounded bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                >
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    {dest.city_name}{dest.country ? `, ${dest.country}` : ''}
                  </div>
                  {dest.arrival_date && dest.departure_date && (
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">
                      {dest.arrival_date} → {dest.departure_date}
                    </div>
                  )}
                </div>
              ))}
              {(!destinations || destinations.length === 0) && (
                <div className="text-[10px] text-gray-400 italic">{t('exportWriter.travelData.noDestinations')}</div>
              )}
            </div>
          </CollapsibleSection>
        </div>
      </div>
    );
  }

  // Destination-specific view
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-gray-900">
        <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate block">
            {destination?.city_name || t('trips.destination')}
          </span>
          {destination?.arrival_date && destination?.departure_date && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {destination.arrival_date} → {destination.departure_date}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-xs">{t('exportWriter.travelData.loading')}</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* View mode toggle — only show when schedule data exists */}
            {hasScheduledPOIs && (
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setViewMode('category')}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium transition-colors ${
                    activeViewMode === 'category'
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    {t('exportWriter.travelData.byCategory')}
                  </button>
                <button
                  onClick={() => setViewMode('schedule')}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium transition-colors ${
                    activeViewMode === 'schedule'
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  >
                    <Calendar className="w-2.5 h-2.5" />
                    {t('exportWriter.travelData.byDay')}
                  </button>
                </div>
              )}

            {/* POIs — Category view */}
            {activeViewMode === 'category' && (
              <CollapsibleSection
                title={t('exportWriter.travelData.places')}
                icon={<MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                count={totalPOIs}
              >
                {pois.length > 0 ? (
                  pois.map((group) => (
                    <POICategoryGroup
                      key={group.category}
                      category={group.category}
                      poiList={group.pois}
                      onPreparePrompt={handlePreparePrompt}
                      prepareDisabled={isPromptContextLoading}
                      t={t}
                    />
                  ))
                ) : (
                  <div className="text-[10px] text-gray-400 italic py-1">{t('exportWriter.travelData.noPois')}</div>
                )}
              </CollapsibleSection>
            )}

            {/* POIs — Schedule/Day view */}
            {activeViewMode === 'schedule' && scheduleData && (
              <CollapsibleSection
                title={t('exportWriter.travelData.dailySchedule')}
                icon={<Calendar className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                count={totalPOIs}
              >
                {Object.entries(scheduleData.scheduled)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, datePois]) => (
                    <DayScheduleGroup
                      key={date}
                      date={date}
                      pois={datePois}
                      dayRoute={dayRoutes[date]}
                      onPreparePrompt={handlePreparePrompt}
                      onInsertDayRoute={onInsertDayRoute}
                      prepareDisabled={isPromptContextLoading}
                      destinationId={destinationId}
                      t={t}
                    />
                  ))}

                {scheduleData.unscheduled && scheduleData.unscheduled.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                      📌 {t('exportWriter.travelData.unscheduled')}
                    </div>
                    <div className="space-y-1">
                      {scheduleData.unscheduled.map((poi) => (
                        <ExpandablePOICard
                          key={poi.id}
                          poi={poi}
                          onPreparePrompt={handlePreparePrompt}
                          prepareDisabled={isPromptContextLoading}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleSection>
            )}

            <CollapsibleSection
              title={t('exportWriter.travelData.notes')}
              icon={<Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
              count={destinationNotes.length}
              defaultOpen={destinationNotes.length > 0}
            >
              {destinationNotes.length > 0 ? (
                <div className="space-y-1">
                  {destinationNotes.map((note) => (
                    <NoteCard key={note.id} note={note} t={t} />
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 italic py-1">{t('exportWriter.travelData.noNotes')}</div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title={t('exportWriter.travelData.accommodations')}
              icon={<Bed className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
              count={accommodations.length}
              defaultOpen={accommodations.length > 0}
            >
              {accommodations.length > 0 ? (
                <div className="space-y-1">
                  {accommodations.map((acc) => (
                    <AccommodationCard key={acc.id} acc={acc} />
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 italic py-1">{t('exportWriter.travelData.noAccommodations')}</div>
              )}
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
};

export default TravelContextPanel;
