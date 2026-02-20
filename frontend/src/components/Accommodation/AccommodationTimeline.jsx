import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bed, Plus, ChevronUp } from 'lucide-react';
import TriangleAlertIcon from '@/components/icons/triangle-alert-icon';
import DownChevron from '@/components/icons/down-chevron';
import { formatDateWithWeekday, parseDateString } from '../../utils/dateFormat';
import AccommodationCard from './AccommodationCard';

/**
 * AccommodationTimeline - Compact visual timeline showing accommodation coverage
 */

// Distinct colors for different accommodations
const accommodationColorPalette = [
  { bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', light: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' },
  { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', light: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800' },
  { bg: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', light: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800' },
  { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', light: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800' },
  { bg: 'bg-pink-500', text: 'text-pink-600 dark:text-pink-400', light: 'bg-pink-50 dark:bg-pink-900/30', border: 'border-pink-200 dark:border-pink-800' },
  { bg: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400', light: 'bg-cyan-50 dark:bg-cyan-900/30', border: 'border-cyan-200 dark:border-cyan-800' },
  { bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', light: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-200 dark:border-rose-800' },
  { bg: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', light: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800' },
];

const AccommodationTimeline = ({
  destination,
  accommodations = [],
  onAddForGap,
  onEditAccommodation,
  onCenterOnAccommodation,
  onAddAccommodation,
  className = '',
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Map accommodation IDs to colors
  const accommodationColors = useMemo(() => {
    const colorMap = {};
    accommodations.forEach((acc, index) => {
      colorMap[acc.id] = accommodationColorPalette[index % accommodationColorPalette.length];
    });
    return colorMap;
  }, [accommodations]);

  // Generate array of all nights in the destination stay
  const nights = useMemo(() => {
    if (!destination?.arrival_date || !destination?.departure_date) return [];

    const result = [];
    const arrival = parseDateString(destination.arrival_date);
    const departure = parseDateString(destination.departure_date);
    if (!arrival || !departure) return [];
    let current = new Date(arrival);
    let nightNum = 1;

    while (current < departure) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      result.push({
        nightNumber: nightNum,
        date: dateStr,
        displayDate: formatDateWithWeekday(dateStr),
      });
      current.setDate(current.getDate() + 1);
      nightNum++;
    }

    return result;
  }, [destination]);

  // Map each night to its accommodation (if any)
  const nightCoverage = useMemo(() => {
    const coverage = {};

    nights.forEach((night) => {
      coverage[night.date] = null;
    });

    accommodations.forEach((acc) => {
      let current = parseDateString(acc.check_in_date);
      const checkOut = parseDateString(acc.check_out_date);
      if (!current || !checkOut) return;

      while (current < checkOut) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        if (Object.hasOwn(coverage, dateStr)) {
          coverage[dateStr] = acc;
        }
        current.setDate(current.getDate() + 1);
      }
    });

    return coverage;
  }, [nights, accommodations]);

  // Find gaps (consecutive nights without accommodation)
  const gaps = useMemo(() => {
    const gapList = [];
    let currentGap = null;

    nights.forEach((night) => {
      if (!nightCoverage[night.date]) {
        if (!currentGap) {
          currentGap = { startDate: night.date, nights: [night] };
        } else {
          currentGap.nights.push(night);
        }
      } else {
        if (currentGap) {
          const lastNight = currentGap.nights[currentGap.nights.length - 1];
          const endDate = parseDateString(lastNight.date);
          if (endDate) {
            endDate.setDate(endDate.getDate() + 1);
            const y = endDate.getFullYear();
            const m = String(endDate.getMonth() + 1).padStart(2, '0');
            const d = String(endDate.getDate()).padStart(2, '0');
            currentGap.endDate = `${y}-${m}-${d}`;
          }
          gapList.push(currentGap);
          currentGap = null;
        }
      }
    });

    // Handle gap at end
    if (currentGap) {
      const lastNight = currentGap.nights[currentGap.nights.length - 1];
      const endDate = parseDateString(lastNight.date);
      if (endDate) {
        endDate.setDate(endDate.getDate() + 1);
        const y = endDate.getFullYear();
        const m = String(endDate.getMonth() + 1).padStart(2, '0');
        const d = String(endDate.getDate()).padStart(2, '0');
        currentGap.endDate = `${y}-${m}-${d}`;
      }
      gapList.push(currentGap);
    }

    return gapList;
  }, [nights, nightCoverage]);

  const hasGaps = gaps.length > 0;
  const totalNights = nights.length;
  const coveredNights = nights.filter((n) => nightCoverage[n.date]).length;

  if (nights.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {/* Compact Header with Smart Summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <Bed className="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {t('accommodation.stays')}
          </span>
          {/* Collapsed smart summary */}
          {!isExpanded && accommodations.length > 0 && !hasGaps && (
            <span className="text-[11px] text-green-600 dark:text-green-400 truncate">
              — {accommodations.map(a => a.name).join(', ')} ({coveredNights}n)
            </span>
          )}
          {!isExpanded && hasGaps && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              — {t('accommodation.nightsUncovered', { count: gaps.reduce((sum, g) => sum + g.nights.length, 0) })}
            </span>
          )}
          {!isExpanded && accommodations.length === 0 && !hasGaps && totalNights > 0 && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              — {t('accommodation.noStaysAdded')}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {hasGaps && (
            <TriangleAlertIcon className="w-3 h-3 text-amber-500" />
          )}
          {!hasGaps && accommodations.length > 0 && coveredNights === totalNights && (
            <span className="w-3 h-3 text-green-500 text-xs font-bold leading-none flex items-center justify-center">&#10003;</span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <DownChevron className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      <div
        className={`space-y-2 transition-all duration-200 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[600px] opacity-100 px-3 pb-2 overflow-y-auto' : 'max-h-0 opacity-0 px-3 pb-0'
        }`}
      >
          {/* Timeline Bar */}
          <div className="relative">
            <div className="flex h-6 rounded overflow-hidden bg-gray-100 dark:bg-gray-700/50 gap-0">
              {nights.map((night, index) => {
                const accommodation = nightCoverage[night.date];
                const isGap = !accommodation;
                const colorSet = accommodation ? accommodationColors[accommodation.id] : null;
                const bgColor = colorSet ? colorSet.bg : '';

                // Check boundaries for potential future use (e.g., rounded corners)
                const prevNight = index > 0 ? nights[index - 1] : null;
                const nextNight = index < nights.length - 1 ? nights[index + 1] : null;
                const prevAcc = prevNight ? nightCoverage[prevNight.date] : null;
                const nextAcc = nextNight ? nightCoverage[nextNight.date] : null;
                const _isStart = accommodation && (!prevAcc || prevAcc.id !== accommodation.id);
                const _isEnd = accommodation && (!nextAcc || nextAcc.id !== accommodation.id);

                return (
                  <div
                    key={night.date}
                    className={`
                      flex-1 relative transition-all flex items-center justify-center min-w-0
                      ${bgColor}
                      ${isGap ? 'cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/50 bg-transparent' : 'cursor-pointer hover:opacity-80'}
                    `}
                    onClick={() => {
                      if (isGap && onAddForGap) {
                        const gap = gaps.find((g) => g.nights.some((n) => n.date === night.date));
                        if (gap) {
                          onAddForGap(gap.startDate, gap.endDate);
                        }
                      } else if (accommodation && onEditAccommodation) {
                        onEditAccommodation(accommodation);
                      }
                    }}
                    title={
                      isGap
                        ? t('accommodation.nightClickToAdd', { number: night.nightNumber })
                        : t('accommodation.nightLabel', { number: night.nightNumber, name: accommodation.name })
                    }
                  >
                    {isGap && (
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">
                        {night.nightNumber}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accommodation Cards */}
          {accommodations.length > 0 && (
            <div className="space-y-1.5">
              {accommodations.map((acc) => {
                const colorSet = accommodationColors[acc.id];
                const hasLocation = acc.latitude && acc.longitude;

                return (
                  <div key={acc.id} className="flex">
                    <div className={`w-1 rounded-l-lg flex-shrink-0 ${colorSet.bg}`} />
                    <div className="flex-1 min-w-0">
                      <AccommodationCard
                        accommodation={acc}
                        isCompact
                        onEdit={onEditAccommodation}
                        onShowOnMap={hasLocation ? onCenterOnAccommodation : undefined}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Gap warning - compact */}
          {hasGaps && onAddForGap && (
            <button
              onClick={() => {
                const firstGap = gaps[0];
                onAddForGap(firstGap.startDate, firstGap.endDate);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              <TriangleAlertIcon className="w-3 h-3" />
              <span>
                {t('accommodation.nightsUncovered', { count: gaps.reduce((sum, g) => sum + g.nights.length, 0) })}
              </span>
              <Plus className="w-3 h-3" />
            </button>
          )}

          {/* Add button - only show if no accommodations */}
          {accommodations.length === 0 && onAddAccommodation && (
            <button
              onClick={onAddAccommodation}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {t('accommodation.addAccommodation')}
            </button>
          )}
      </div>
    </div>
  );
};

export default AccommodationTimeline;
