/**
 * WelcomeAnimation - Animated welcome screen for AI chat
 * Shows animated globe and travel-themed particles
 */

import React from 'react';
import { MapPin, Compass, Sun, Mountain, Palmtree } from 'lucide-react';
import AirplaneIcon from '@/components/icons/airplane-icon';

// Floating travel icon component
const FloatingIcon = ({ icon: Icon, delay, duration, startX, startY, color }) => (
  <div
    className="absolute animate-float opacity-20"
    style={{
      left: `${startX}%`,
      top: `${startY}%`,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  >
    <Icon className={`w-5 h-5 ${color}`} />
  </div>
);

const WelcomeAnimation = ({ agentName, onSuggestionClick, suggestions = [] }) => {
  return (
    <div className="relative h-full flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      {/* Background floating icons */}
      <div className="absolute inset-0 pointer-events-none">
        <FloatingIcon icon={AirplaneIcon} delay={0} duration={6} startX={10} startY={20} color="text-[#D97706]" />
        <FloatingIcon icon={MapPin} delay={1} duration={7} startX={80} startY={15} color="text-emerald-500" />
        <FloatingIcon icon={Compass} delay={2} duration={5} startX={15} startY={70} color="text-blue-500" />
        <FloatingIcon icon={Sun} delay={0.5} duration={8} startX={85} startY={65} color="text-yellow-500" />
        <FloatingIcon icon={Mountain} delay={1.5} duration={6} startX={75} startY={40} color="text-gray-500" />
        <FloatingIcon icon={Palmtree} delay={2.5} duration={7} startX={20} startY={45} color="text-green-500" />
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Animated logo */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-[#D97706]/20 animate-ping" style={{ animationDuration: '3s' }} />

          {/* Inner gradient circle */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#D97706] to-[#EA580C] shadow-lg shadow-orange-500/30 flex items-center justify-center animate-pulse" style={{ animationDuration: '2s' }}>
            <Compass className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Welcome text */}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {agentName || 'Travel Assistant'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 max-w-xs mx-auto">
          Your AI-powered travel companion. Let's plan something amazing together!
        </p>

        {/* Suggestions grid */}
        {suggestions.length > 0 && (
          <div className="grid grid-cols-2 gap-2 w-full max-w-sm mx-auto">
            {suggestions.map((suggestion, idx) => (
              <button
                key={suggestion.text}
                onClick={() => onSuggestionClick(suggestion.text)}
                className="group flex items-center gap-2 px-3 py-3 text-sm text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-xl transition-all duration-200 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-[#D97706]/50 hover:shadow-md hover:scale-[1.02]"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <span className="text-lg group-hover:scale-110 transition-transform">{suggestion.emoji}</span>
                <span className="truncate font-medium">{suggestion.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CSS for floating animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-10px) rotate(5deg);
          }
          50% {
            transform: translateY(-5px) rotate(-3deg);
          }
          75% {
            transform: translateY(-15px) rotate(3deg);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default WelcomeAnimation;
