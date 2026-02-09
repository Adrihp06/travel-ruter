/**
 * ThinkingIndicator - Shows AI is thinking with contextual messages
 * More informative than just bouncing dots
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, MapPin, Route, Calculator, Calendar } from 'lucide-react';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import SparklesIcon from '@/components/icons/sparkles-icon';

// Thinking message configs - text resolved via i18n at render time
const THINKING_MESSAGES = [
  { icon: Brain, textKey: 'ai.thinking' },
  { icon: MagnifierIcon, textKey: 'ai.analyzingRequest' },
  { icon: MapPin, textKey: 'ai.findingPlaces' },
  { icon: Route, textKey: 'ai.planningRoutes' },
  { icon: Calculator, textKey: 'ai.crunchingNumbers' },
  { icon: Calendar, textKey: 'ai.optimizingSchedule' },
  { icon: SparklesIcon, textKey: 'ai.almostThere' },
];

// Context-aware messages based on what the AI might be doing
const CONTEXT_MESSAGES = {
  destination: [
    { icon: MapPin, textKey: 'ai.searchingDestinations' },
    { icon: MagnifierIcon, textKey: 'ai.findingCoordinates' },
  ],
  poi: [
    { icon: MapPin, textKey: 'ai.discoveringAttractions' },
    { icon: MagnifierIcon, textKey: 'ai.findingRestaurants' },
    { icon: SparklesIcon, textKey: 'ai.curatingSpots' },
  ],
  route: [
    { icon: Route, textKey: 'ai.calculatingRoutes' },
    { icon: Calculator, textKey: 'ai.measuringDistances' },
  ],
  schedule: [
    { icon: Calendar, textKey: 'ai.creatingSchedule' },
    { icon: Brain, textKey: 'ai.optimizingDay' },
  ],
  budget: [
    { icon: Calculator, textKey: 'ai.calculatingCosts' },
    { icon: SparklesIcon, textKey: 'ai.analyzingBudget' },
  ],
};

const ThinkingIndicator = ({ context = null, minimal = false }) => {
  const { t } = useTranslation();
  const [messageIndex, setMessageIndex] = useState(0);

  // Get messages based on context or use default
  const messages = context && CONTEXT_MESSAGES[context]
    ? CONTEXT_MESSAGES[context]
    : THINKING_MESSAGES;

  // Rotate messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [messages.length]);

  const currentMessage = messages[messageIndex];
  const Icon = currentMessage.icon;

  if (minimal) {
    // Just show bouncing dots
    return (
      <div className="flex items-center gap-1 py-2">
        <div className="w-2 h-2 rounded-full bg-[#D97706] animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-[#D97706] animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-[#D97706] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 rounded-xl border border-[#D97706]/20">
      {/* Animated icon */}
      <div className="relative">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D97706] to-[#EA580C] flex items-center justify-center">
          <Icon className="w-4 h-4 text-white animate-pulse" />
        </div>
        {/* Ping effect */}
        <div className="absolute inset-0 rounded-lg bg-[#D97706] animate-ping opacity-20" />
      </div>

      {/* Message */}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-all duration-300">
          {t(currentMessage.textKey)}
        </p>
      </div>

      {/* Animated dots */}
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};

export default ThinkingIndicator;
