/**
 * VoiceTranscript - Scrollable conversation transcript with tool call display.
 */

import React, { useRef, useEffect } from 'react';
import {
  MapPin, Navigation, Compass, Mouse, BellRing, Search,
  Plane, Calendar, Calculator, Route, Grid3X3, Star, Map,
} from 'lucide-react';

const TOOL_ICONS = {
  navigate_to: Navigation,
  highlight_poi: MapPin,
  show_on_map: Compass,
  open_modal: Mouse,
  scroll_to: Navigation,
  show_notification: BellRing,
  search_destinations: Search,
  get_poi_suggestions: Star,
  manage_trip: Plane,
  manage_poi: MapPin,
  manage_destination: Map,
  calculate_route: Route,
  get_travel_matrix: Grid3X3,
  generate_smart_schedule: Calendar,
  calculate_budget: Calculator,
  schedule_pois: Calendar,
};

const ToolCallEntry = ({ toolCall }) => {
  const Icon = TOOL_ICONS[toolCall.name] || Search;
  const isDone = toolCall.status === 'complete';
  const isError = toolCall.result && !toolCall.result.success;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
      <div className={`
        w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
        ${isDone
          ? isError ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
          : 'bg-[#D97706]/20 text-[#D97706] animate-pulse'
        }
      `}>
        <Icon className="w-3 h-3" />
      </div>
      <span className="text-gray-400 truncate">{toolCall.name}</span>
      {isDone && (
        <span className={`ml-auto text-[10px] ${isError ? 'text-red-400' : 'text-green-400'}`}>
          {isError ? 'error' : 'done'}
        </span>
      )}
      {!isDone && (
        <span className="ml-auto text-[10px] text-[#D97706] animate-pulse">running</span>
      )}
    </div>
  );
};

const VoiceTranscript = ({ transcript = [], activeToolCalls = [] }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.length, activeToolCalls.length]);

  if (transcript.length === 0 && activeToolCalls.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="text-gray-500 text-sm text-center">
          Pulsa el micrófono y habla para empezar
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
      {transcript.map((entry, i) => (
        <div key={i} className="flex gap-2 items-start">
          {entry.role === 'user' && (
            <>
              <span className="text-[11px] font-semibold text-[#D97706] min-w-[28px] mt-0.5">You:</span>
              <span className="text-[13px] text-gray-300">{entry.text}</span>
            </>
          )}
          {entry.role === 'model' && (
            <>
              <span className="text-[11px] font-semibold text-green-400 min-w-[28px] mt-0.5">AI:</span>
              <span className="text-[13px] text-gray-300">{entry.text}</span>
            </>
          )}
          {entry.role === 'tool' && entry.toolCall && (
            <ToolCallEntry toolCall={entry.toolCall} />
          )}
        </div>
      ))}

      {/* Active tool calls (currently running) */}
      {activeToolCalls
        .filter((tc) => tc.status === 'running')
        .map((tc) => (
          <ToolCallEntry key={tc.id} toolCall={tc} />
        ))}

      <div ref={bottomRef} />
    </div>
  );
};

export default VoiceTranscript;
