/**
 * ToolCallDisplay - Displays tool calls with status, arguments, and results
 * Shows transparency about which tools the AI is using
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Route,
  Grid3X3,
  Calendar,
  Calculator,
  Cloud,
  ChevronDown,
  ChevronRight,
  Map,
  Star,
  CalendarCheck,
} from 'lucide-react';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import AirplaneIcon from '@/components/icons/airplane-icon';
import GlobeIcon from '@/components/icons/globe-icon';
import OpenAIIcon from '@/components/icons/openai-icon';
import CurrencyDollarIcon from '@/components/icons/currency-dollar-icon';
import CheckedIcon from '@/components/icons/checked-icon';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import SparklesIcon from '@/components/icons/sparkles-icon';

// Tool metadata with icons and descriptions (names/descriptions resolved via i18n at render time)
const TOOL_INFO = {
  search_destinations: {
    icon: MagnifierIcon,
    nameKey: 'ai.agent.toolNames.searchDestinations',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-300',
    descriptionKey: 'ai.findingCoordinates',
  },
  get_poi_suggestions: {
    icon: GlobeIcon,
    nameKey: 'ai.agent.toolNames.poiSuggestions',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-300',
    descriptionKey: 'ai.discoveringAttractions',
  },
  calculate_route: {
    icon: Route,
    nameKey: 'ai.agent.toolNames.routeCalculator',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    textColor: 'text-orange-700 dark:text-orange-300',
    descriptionKey: 'ai.planningRoutes',
  },
  get_travel_matrix: {
    icon: Grid3X3,
    nameKey: 'ai.agent.toolNames.travelMatrix',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    textColor: 'text-purple-700 dark:text-purple-300',
    descriptionKey: 'ai.measuringDistances',
  },
  manage_trip: {
    icon: AirplaneIcon,
    nameKey: 'ai.agent.toolNames.tripManagement',
    color: 'bg-[#D97706]',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-[#D97706] dark:text-amber-300',
    descriptionKey: 'ai.managingTrip',
  },
  manage_destination: {
    icon: Map,
    nameKey: 'ai.agent.toolNames.destinationManagement',
    color: 'bg-teal-500',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    textColor: 'text-teal-700 dark:text-teal-300',
    descriptionKey: 'ai.managingDestination',
  },
  manage_poi: {
    icon: Star,
    nameKey: 'ai.agent.toolNames.poiManagement',
    color: 'bg-rose-500',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    textColor: 'text-rose-700 dark:text-rose-300',
    descriptionKey: 'ai.managingPOI',
  },
  schedule_pois: {
    icon: CalendarCheck,
    nameKey: 'ai.agent.toolNames.poiScheduler',
    color: 'bg-violet-500',
    bgColor: 'bg-violet-50 dark:bg-violet-900/20',
    textColor: 'text-violet-700 dark:text-violet-300',
    descriptionKey: 'ai.schedulingPOIs',
  },
  generate_smart_schedule: {
    icon: Calendar,
    nameKey: 'ai.agent.toolNames.smartScheduler',
    color: 'bg-pink-500',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    textColor: 'text-pink-700 dark:text-pink-300',
    descriptionKey: 'ai.creatingSchedule',
  },
  calculate_budget: {
    icon: Calculator,
    nameKey: 'ai.agent.toolNames.budgetCalculator',
    color: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
    descriptionKey: 'ai.calculatingCosts',
  },
  web_search: {
    icon: OpenAIIcon,
    nameKey: 'ai.agent.toolNames.webSearch',
    color: 'bg-black',
    bgColor: 'bg-gray-100 dark:bg-gray-800/40',
    textColor: 'text-gray-900 dark:text-gray-100',
    descriptionKey: 'ai.searchingWeb',
  },
  weather_forecast: {
    icon: Cloud,
    nameKey: 'ai.agent.toolNames.weatherForecast',
    color: 'bg-sky-500',
    bgColor: 'bg-sky-50 dark:bg-sky-900/20',
    textColor: 'text-sky-700 dark:text-sky-300',
    descriptionKey: 'ai.checkingWeather',
  },
  currency_conversion: {
    icon: CurrencyDollarIcon,
    nameKey: 'ai.agent.toolNames.currencyConversion',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    descriptionKey: 'ai.convertingCurrency',
  },
};

// Default tool info for unknown tools
const DEFAULT_TOOL = {
  icon: SparklesIcon,
  nameKey: 'ai.tool',
  color: 'bg-gray-500',
  bgColor: 'bg-gray-50 dark:bg-gray-800',
  textColor: 'text-gray-700 dark:text-gray-300',
  descriptionKey: 'ai.processing',
};

/**
 * Format tool arguments for display
 */
const formatArguments = (args) => {
  if (!args) return null;

  // Handle string arguments
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return args;
    }
  }

  // Pick key arguments to display
  const keyArgs = [];

  if (args.query) keyArgs.push({ key: 'Query', value: args.query });
  if (args.operation) keyArgs.push({ key: 'Operation', value: args.operation });
  if (args.location) keyArgs.push({ key: 'Location', value: args.location });
  if (args.name) keyArgs.push({ key: 'Name', value: args.name });
  if (args.latitude && args.longitude) {
    keyArgs.push({ key: 'Coords', value: `${args.latitude.toFixed(4)}, ${args.longitude.toFixed(4)}` });
  }
  if (args.category) keyArgs.push({ key: 'Category', value: args.category });
  if (args.trip_type) keyArgs.push({ key: 'Trip Type', value: args.trip_type });
  if (args.radius) keyArgs.push({ key: 'Radius', value: `${args.radius}m` });
  if (args.trip_id) keyArgs.push({ key: 'Trip ID', value: `#${args.trip_id}` });
  if (args.destination_id) keyArgs.push({ key: 'Destination', value: `#${args.destination_id}` });
  if (args.poi_id) keyArgs.push({ key: 'POI', value: `#${args.poi_id}` });
  if (args.city_name) keyArgs.push({ key: 'City', value: args.city_name });
  if (args.scheduled_date) keyArgs.push({ key: 'Date', value: args.scheduled_date });
  if (args.assignments) keyArgs.push({ key: 'POIs', value: `${args.assignments.length} assignments` });
  if (args.profile) keyArgs.push({ key: 'Transport', value: args.profile });
  if (args.context) keyArgs.push({ key: 'Context', value: args.context });

  return keyArgs.length > 0 ? keyArgs : null;
};

/**
 * Single tool call item
 */
const ToolCallItem = ({ toolCall, isStreaming, result, isError }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullResult, setShowFullResult] = useState(false);

  const toolInfo = TOOL_INFO[toolCall.name] || { ...DEFAULT_TOOL, nameKey: toolCall.name };
  const Icon = toolInfo.icon;
  const args = formatArguments(toolCall.arguments);

  // Determine status
  const status = isStreaming ? 'running' : (isError ? 'error' : 'success');

  return (
    <div className={`rounded-lg border ${toolInfo.bgColor} border-opacity-50 overflow-hidden transition-all duration-200`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        {/* Icon */}
        <div className={`w-7 h-7 rounded-md ${toolInfo.color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>

        {/* Tool name and description */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${toolInfo.textColor}`}>
              {t(toolInfo.nameKey)}
            </span>
            {args && args.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {args[0].value}
              </span>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {status === 'running' && (
            <div className="w-16 h-1.5 bg-amber-200 dark:bg-amber-900/40 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          )}
          {status === 'success' && (
            <div className="flex items-center gap-1">
              <CheckedIcon className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">{t('ai.done')}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-1">
              <InfoCircleIcon className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-600 dark:text-red-400">{t('ai.failed')}</span>
            </div>
          )}

          {/* Expand toggle */}
          {(args || result) && (
            <div className="ml-1">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (args || result) && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
          {/* Arguments */}
          {args && args.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('ai.parameters')}</p>
              <div className="flex flex-wrap gap-1.5">
                {args.map((arg, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300"
                  >
                    <span className="font-medium mr-1">{arg.key}:</span>
                    <span className="truncate max-w-[150px]">{arg.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Result preview */}
          {result && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('ai.result')}</p>
              <pre className="text-xs bg-white/60 dark:bg-gray-800/60 rounded p-2 overflow-x-auto max-h-48 text-gray-700 dark:text-gray-300">
                {(() => {
                  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                  if (text.length <= 500 || showFullResult) return text;
                  return text.slice(0, 500) + '...';
                })()}
              </pre>
              {((typeof result === 'string' ? result : JSON.stringify(result, null, 2)).length > 500) && (
                <button
                  onClick={() => setShowFullResult(!showFullResult)}
                  className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showFullResult ? (t('ai.showLess') || 'Show less') : (t('ai.showMore') || 'Show more')}
                </button>
              )}
            </div>
          )}

          {/* Source URLs for get_poi_suggestions results */}
          {toolCall.name === 'get_poi_suggestions' && (() => {
            let parsed = result;
            if (typeof result === 'string') {
              try { parsed = JSON.parse(result); } catch { parsed = null; }
            }
            const sources = parsed?.filters_applied?.sources;
            if (!sources || sources.length === 0) return null;
            return (
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t('ai.webSources')}
                </p>
                <ul className="space-y-0.5">
                  {sources.map((url, idx) => (
                    <li key={idx}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-full"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

/**
 * Container for multiple tool calls
 */
const ToolCallDisplay = ({ toolCalls, isStreaming, toolResults = [] }) => {
  const { t } = useTranslation();
  if (!toolCalls || toolCalls.length === 0) return null;

  // Match results with tool calls — supports both embedded results (parts system)
  // and separate toolResults array (legacy/REST)
  const getResultForTool = (tc) => {
    if (tc.result) return tc.result;
    const result = toolResults.find(r => r.toolCallId === tc.id);
    return result ? { content: result.content, isError: result.isError } : null;
  };

  return (
    <div className="space-y-2 my-3">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <SparklesIcon className="w-3.5 h-3.5" />
        <span>{t('ai.usingTools', { count: toolCalls.length })}</span>
      </div>

      {toolCalls.map((tc, idx) => {
        const result = getResultForTool(tc);
        // A tool is "running" if streaming is active AND this tool has no result yet
        const isRunning = isStreaming && !result;
        return (
          <ToolCallItem
            key={tc.id || idx}
            toolCall={tc}
            isStreaming={isRunning}
            result={result?.content}
            isError={result?.isError}
          />
        );
      })}
    </div>
  );
};

export default ToolCallDisplay;
