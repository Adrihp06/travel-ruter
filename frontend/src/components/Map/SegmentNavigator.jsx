import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Car, Footprints, Bike, Train, Plane, Ship, Bus, AlertTriangle } from 'lucide-react';
import SegmentHoverCard from './SegmentHoverCard';

// Transport mode icons mapping
const TRANSPORT_MODE_ICONS = {
  car: Car,
  driving: Car,
  walk: Footprints,
  walking: Footprints,
  bike: Bike,
  cycling: Bike,
  train: Train,
  bus: Bus,
  plane: Plane,
  flight: Plane,
  ferry: Ship,
};

// Transport mode colors
const TRANSPORT_MODE_COLORS = {
  car: '#4F46E5',
  driving: '#4F46E5',
  walk: '#10B981',
  walking: '#10B981',
  bike: '#F59E0B',
  cycling: '#F59E0B',
  train: '#8B5CF6',
  bus: '#EC4899',
  plane: '#3B82F6',
  flight: '#3B82F6',
  ferry: '#06B6D4',
};

const VISIBLE_COUNT = 5;
const HOVER_DELAY = 200;

/**
 * Navigation component for travel segments with sliding window, hover cards, and click-to-center
 */
const SegmentNavigator = ({
  segments = [],
  destinations = [],
  selectedSegmentId = null,
  onSegmentClick = null,
}) => {
  // Sort segments based on destination order
  const sortedSegments = useMemo(() => {
    if (!segments || !destinations) return [];
    return [...segments].sort((a, b) => {
      const indexA = destinations.findIndex(d => d.id === a.from_destination_id);
      const indexB = destinations.findIndex(d => d.id === b.from_destination_id);
      return indexA - indexB;
    });
  }, [segments, destinations]);

  // startIndex represents the first visible segment in the sliding window
  const [startIndex, setStartIndex] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [showHoverCard, setShowHoverCard] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  const totalSegments = sortedSegments.length;
  const maxStartIndex = Math.max(0, totalSegments - VISIBLE_COUNT);
  const endIndex = Math.min(startIndex + VISIBLE_COUNT, totalSegments);
  const visibleSegments = sortedSegments.slice(startIndex, endIndex);

  // Get destination name by ID
  const getDestinationName = useCallback((destinationId) => {
    const dest = destinations.find(d => d.id === destinationId);
    return dest?.name || dest?.city_name || 'Unknown';
  }, [destinations]);

  // Handle sliding window navigation (scroll by 1)
  const goToPrev = useCallback(() => {
    setStartIndex(prev => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setStartIndex(prev => Math.min(maxStartIndex, prev + 1));
  }, [maxStartIndex]);

  // Handle hover with delay
  const handleMouseEnter = useCallback((segment, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setHoverPosition({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top,
      });
    }

    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredSegment(segment);
      setShowHoverCard(true);
    }, HOVER_DELAY);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowHoverCard(false);
    setHoveredSegment(null);
  }, []);

  // Handle segment click
  const handleSegmentClick = useCallback((segment) => {
    if (onSegmentClick) {
      onSegmentClick(segment);
    }
  }, [onSegmentClick]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Reset startIndex when segments change significantly
  useEffect(() => {
    if (startIndex > maxStartIndex) {
      setStartIndex(maxStartIndex);
    }
  }, [startIndex, maxStartIndex]);

  if (totalSegments === 0) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Hover Card */}
      <SegmentHoverCard
        segment={hoveredSegment}
        fromName={hoveredSegment ? getDestinationName(hoveredSegment.from_destination_id) : ''}
        toName={hoveredSegment ? getDestinationName(hoveredSegment.to_destination_id) : ''}
        position={hoverPosition}
        visible={showHoverCard}
      />

      <div className="flex items-center gap-1">
        {/* Left Arrow - show when there are more than VISIBLE_COUNT segments */}
        {totalSegments > VISIBLE_COUNT && (
          <button
            onClick={goToPrev}
            disabled={startIndex === 0}
            className={`p-1 rounded transition-colors ${
              startIndex === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            aria-label="Previous segment"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Segment Icons */}
        <div className="flex items-center gap-1">
          {visibleSegments.map((segment) => {
            const Icon = TRANSPORT_MODE_ICONS[segment.travel_mode] || Car;
            const color = segment.is_fallback
              ? '#dc2626'
              : (TRANSPORT_MODE_COLORS[segment.travel_mode] || TRANSPORT_MODE_COLORS.car);
            const isSelected = selectedSegmentId === segment.id;
            
            // Calculate destination indices (1-based)
            const fromIndex = destinations.findIndex(d => d.id === segment.from_destination_id) + 1;
            const toIndex = destinations.findIndex(d => d.id === segment.to_destination_id) + 1;

            return (
              <button
                key={segment.id}
                onClick={() => handleSegmentClick(segment)}
                onMouseEnter={(e) => handleMouseEnter(segment, e)}
                onMouseLeave={handleMouseLeave}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-offset-1 scale-110'
                    : 'hover:scale-110 hover:bg-gray-100'
                } ${segment.is_fallback ? 'bg-red-50' : ''}`}
                style={{
                  color,
                  ringColor: isSelected ? color : undefined,
                }}
                title={segment.is_fallback 
                  ? `Actual ${segment.travel_mode} route unavailable, showing estimated car route`
                  : segment.travel_mode}
              >
                <div className="relative flex flex-col items-center">
                  <Icon className="w-4 h-4 mb-1" />
                  {segment.is_fallback && (
                    <AlertTriangle className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 text-red-600 bg-red-50 rounded-full" />
                  )}
                  <span 
                    className="text-[8px] font-bold leading-none px-1.5 py-0.5 bg-white rounded-full shadow-sm border mt-0.5"
                    style={{
                      borderColor: color,
                      color: color
                    }}
                  >
                    {fromIndex > 0 && toIndex > 0 ? `${fromIndex}-${toIndex}` : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Arrow */}
        {totalSegments > VISIBLE_COUNT && (
          <button
            onClick={goToNext}
            disabled={startIndex >= maxStartIndex}
            className={`p-1 rounded transition-colors ${
              startIndex >= maxStartIndex
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            aria-label="Next segment"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Position indicator */}
        {totalSegments > VISIBLE_COUNT && (
          <span className="text-xs text-gray-400 ml-1 whitespace-nowrap">
            {startIndex + 1}-{endIndex} of {totalSegments}
          </span>
        )}
      </div>
    </div>
  );
};

export default SegmentNavigator;
