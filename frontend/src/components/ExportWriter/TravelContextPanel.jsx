/**
 * Travel Context Panel — read-only reference showing POIs and accommodations
 * for the selected document's destination (or trip overview).
 */
import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Bed, ChevronDown, ChevronRight, Globe, Loader2 } from 'lucide-react';
import usePOIStore, { usePOIsByCategory, usePOIsLoading } from '../../stores/usePOIStore';
import useAccommodationStore from '../../stores/useAccommodationStore';
import useExportWriterStore from '../../stores/useExportWriterStore';

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

function POICategoryGroup({ category, poiList }) {
  const icon = CATEGORY_ICONS[category?.toLowerCase()] || '📍';

  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
        {icon} {category}
      </div>
      <div className="space-y-1">
        {poiList.map((poi) => (
          <div
            key={poi.id}
            className="flex items-start gap-2 px-2 py-1.5 rounded bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
          >
            <MapPin className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                {poi.name}
              </div>
              {poi.description && (
                <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                  {poi.description}
                </div>
              )}
              {poi.estimated_cost != null && poi.estimated_cost > 0 && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  ~{poi.estimated_cost}€
                </span>
              )}
            </div>
          </div>
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

const TravelContextPanel = ({ trip, destinations }) => {
  const selectedDocId = useExportWriterStore((s) => s.selectedDocId);
  const documents = useExportWriterStore((s) => s.documents);
  const selectedDoc = selectedDocId ? documents[selectedDocId] : null;

  const pois = usePOIsByCategory();
  const poisLoading = usePOIsLoading();
  const fetchPOIsByDestination = usePOIStore((s) => s.fetchPOIsByDestination);
  const accommodations = useAccommodationStore((s) => s.accommodations);
  const accLoading = useAccommodationStore((s) => s.isLoading);
  const fetchAccommodations = useAccommodationStore((s) => s.fetchAccommodations);

  const lastFetchedDestIdRef = useRef(null);

  const destinationId = selectedDoc?.destinationId || null;
  const destination = destinationId
    ? destinations?.find((d) => d.id === destinationId)
    : null;

  // Fetch data when destination changes (parallel)
  useEffect(() => {
    if (destinationId && destinationId !== lastFetchedDestIdRef.current) {
      lastFetchedDestIdRef.current = destinationId;
      Promise.all([
        fetchPOIsByDestination(destinationId),
        fetchAccommodations(destinationId),
      ]);
    }
  }, [destinationId, fetchPOIsByDestination, fetchAccommodations]);

  const isLoading = poisLoading || accLoading;
  const totalPOIs = pois.reduce((sum, group) => sum + group.pois.length, 0);

  // Trip Overview mode: show all destinations summary
  if (!destinationId) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-gray-900">
          <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Trip Overview</span>
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
            title="Destinations"
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
                <div className="text-[10px] text-gray-400 italic">No destinations added yet.</div>
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
            {destination?.city_name || 'Destination'}
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
            <span className="text-xs">Loading travel data...</span>
          </div>
        )}

        {!isLoading && (
          <>
            <CollapsibleSection
              title="Places of Interest"
              icon={<MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
              count={totalPOIs}
            >
              {pois.length > 0 ? (
                pois.map((group) => (
                  <POICategoryGroup
                    key={group.category}
                    category={group.category}
                    poiList={group.pois}
                  />
                ))
              ) : (
                <div className="text-[10px] text-gray-400 italic py-1">No POIs added yet.</div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Accommodations"
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
                <div className="text-[10px] text-gray-400 italic py-1">No accommodations added yet.</div>
              )}
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
};

export default TravelContextPanel;
