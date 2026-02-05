import React, { useMemo } from 'react';
import { AlertTriangle, Calendar, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { formatDateShort } from '../../utils/dateFormat';
import { findDestinationConflicts, findUncoveredNights, findAccommodationGaps } from '../../utils/tripValidation';

const TripWarningsPanel = ({ trip, destinations, accommodationsByDestination = {} }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate validation issues
  const validationIssues = useMemo(() => {
    const conflicts = findDestinationConflicts(destinations);
    const uncoveredNights = findUncoveredNights(trip, destinations);

    // Calculate accommodation gaps per destination
    const accommodationGaps = [];
    (destinations || []).forEach(dest => {
      const accs = accommodationsByDestination[dest.id] || [];
      const gaps = findAccommodationGaps(dest, accs);
      if (gaps.length > 0) {
        accommodationGaps.push({
          destination: dest,
          gaps,
        });
      }
    });

    return {
      conflicts,
      uncoveredNights,
      accommodationGaps,
    };
  }, [trip, destinations, accommodationsByDestination]);

  const { conflicts, uncoveredNights, accommodationGaps } = validationIssues;
  const totalIssues = conflicts.length + (uncoveredNights.length > 0 ? 1 : 0) + accommodationGaps.length;

  // Don't render if no issues
  if (totalIssues === 0) return null;

  return (
    <div className="mb-4">
      <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {totalIssues} {totalIssues === 1 ? 'Issue' : 'Issues'} Found
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
        </button>

        {isExpanded && (
          <div className="border-t border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3 space-y-2">
          {/* Destination Conflicts */}
          {conflicts.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    Date Conflicts
                  </p>
                  <ul className="mt-1 space-y-1">
                    {conflicts.map((conflict, idx) => (
                      <li key={idx} className="text-xs text-red-600 dark:text-red-400">
                        <span className="font-medium">{conflict.dest1.city_name || conflict.dest1.name}</span>
                        {' '}({formatDateShort(conflict.dest1.arrival_date)} - {formatDateShort(conflict.dest1.departure_date)})
                        {' overlaps with '}
                        <span className="font-medium">{conflict.dest2.city_name || conflict.dest2.name}</span>
                        {' '}({formatDateShort(conflict.dest2.arrival_date)} - {formatDateShort(conflict.dest2.departure_date)})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Uncovered Trip Nights */}
          {uncoveredNights.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {uncoveredNights.length} Night{uncoveredNights.length !== 1 ? 's' : ''} Without Destination
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {uncoveredNights.length <= 5 ? (
                      uncoveredNights.map(d => formatDateShort(d)).join(', ')
                    ) : (
                      <>
                        {formatDateShort(uncoveredNights[0])} - {formatDateShort(uncoveredNights[uncoveredNights.length - 1])}
                        {' '}({uncoveredNights.length} nights)
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Accommodation Gaps */}
          {accommodationGaps.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Home className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Accommodation Gaps
                  </p>
                  <ul className="mt-1 space-y-1">
                    {accommodationGaps.map((item, idx) => (
                      <li key={idx} className="text-xs text-blue-600 dark:text-blue-400">
                        <span className="font-medium">{item.destination.city_name || item.destination.name}</span>
                        {': '}
                        {item.gaps.length} night{item.gaps.length !== 1 ? 's' : ''} without accommodation
                        {item.gaps.length <= 3 && (
                          <span className="text-blue-500 dark:text-blue-500">
                            {' '}({item.gaps.map(d => formatDateShort(d)).join(', ')})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default TripWarningsPanel;
