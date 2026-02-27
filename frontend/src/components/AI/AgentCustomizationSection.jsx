/**
 * AgentCustomizationSection - Settings section for customizing the AI agent
 * Allows users to configure agent name, prompts, and tools
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Wand2,
  Wrench,
  MapPin,
  Route,
  Calculator,
  Calendar,
  Cloud,
  ChevronDown,
  ChevronUp,
  Map,
  ListChecks,
  Compass,
} from 'lucide-react';
import GlobeIcon from '@/components/icons/globe-icon';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import CurrencyDollarIcon from '@/components/icons/currency-dollar-icon';
import RefreshIcon from '@/components/icons/refresh-icon';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import useAIStore from '../../stores/useAIStore';

// App tools configuration — must match MCP server tools in mcp_server/tools/
const APP_TOOLS = [
  {
    id: 'search_destinations',
    nameKey: 'ai.agent.toolNames.searchDestinations',
    descriptionKey: 'ai.agent.toolDescriptions.searchDestinations',
    icon: MagnifierIcon,
  },
  {
    id: 'manage_destination',
    nameKey: 'ai.agent.toolNames.destinationManagement',
    descriptionKey: 'ai.agent.toolDescriptions.destinationManagement',
    icon: Map,
  },
  {
    id: 'get_poi_suggestions',
    nameKey: 'ai.agent.toolNames.poiSuggestions',
    descriptionKey: 'ai.agent.toolDescriptions.poiSuggestions',
    icon: MapPin,
  },
  {
    id: 'manage_poi',
    nameKey: 'ai.agent.toolNames.poiManagement',
    descriptionKey: 'ai.agent.toolDescriptions.poiManagement',
    icon: ListChecks,
  },
  {
    id: 'calculate_route',
    nameKey: 'ai.agent.toolNames.routeCalculator',
    descriptionKey: 'ai.agent.toolDescriptions.routeCalculator',
    icon: Route,
  },
  {
    id: 'get_travel_matrix',
    nameKey: 'ai.agent.toolNames.travelMatrix',
    descriptionKey: 'ai.agent.toolDescriptions.travelMatrix',
    icon: Compass,
  },
  {
    id: 'manage_trip',
    nameKey: 'ai.agent.toolNames.tripManagement',
    descriptionKey: 'ai.agent.toolDescriptions.tripManagement',
    icon: Wand2,
  },
  {
    id: 'generate_smart_schedule',
    nameKey: 'ai.agent.toolNames.smartScheduler',
    descriptionKey: 'ai.agent.toolDescriptions.smartScheduler',
    icon: Calendar,
  },
  {
    id: 'calculate_budget',
    nameKey: 'ai.agent.toolNames.budgetCalculator',
    descriptionKey: 'ai.agent.toolDescriptions.budgetCalculator',
    icon: Calculator,
  },
];

// External tools configuration
const EXTERNAL_TOOLS = [
  {
    id: 'openai_search',
    nameKey: 'ai.agent.toolNames.openaiSearch',
    descriptionKey: 'ai.agent.toolDescriptions.openaiSearch',
    icon: GlobeIcon,
  },
  {
    id: 'web_search',
    nameKey: 'ai.agent.toolNames.webSearch',
    descriptionKey: 'ai.agent.toolDescriptions.webSearch',
    icon: GlobeIcon,
  },
  {
    id: 'weather_forecast',
    nameKey: 'ai.agent.toolNames.weatherForecast',
    descriptionKey: 'ai.agent.toolDescriptions.weatherForecast',
    icon: Cloud,
  },
  {
    id: 'currency_conversion',
    nameKey: 'ai.agent.toolNames.currencyConversion',
    descriptionKey: 'ai.agent.toolDescriptions.currencyConversion',
    icon: CurrencyDollarIcon,
  },
];

// Prompt templates
const PROMPT_TEMPLATES = [
  {
    id: 'default',
    nameKey: 'ai.agent.templates.default',
    prompt: '',
    descriptionKey: 'ai.agent.templates.defaultDesc',
  },
  {
    id: 'budget_focused',
    nameKey: 'ai.agent.templates.budget',
    prompt: 'Focus on budget-friendly options. Prioritize affordable accommodations, free attractions, and cost-saving tips. Always mention prices and compare costs.',
    descriptionKey: 'ai.agent.templates.budgetDesc',
  },
  {
    id: 'luxury',
    nameKey: 'ai.agent.templates.luxury',
    prompt: 'Act as a luxury travel concierge. Recommend premium experiences, high-end hotels, fine dining, and exclusive activities. Focus on quality over cost.',
    descriptionKey: 'ai.agent.templates.luxuryDesc',
  },
  {
    id: 'adventure',
    nameKey: 'ai.agent.templates.adventure',
    prompt: 'Focus on adventure and outdoor activities. Recommend hiking, extreme sports, nature experiences, and off-the-beaten-path destinations.',
    descriptionKey: 'ai.agent.templates.adventureDesc',
  },
  {
    id: 'family',
    nameKey: 'ai.agent.templates.family',
    prompt: 'Optimize for family travel. Consider kid-friendly activities, family accommodations, safety, and educational experiences. Suggest activities suitable for different age groups.',
    descriptionKey: 'ai.agent.templates.familyDesc',
  },
];

const AgentCustomizationSection = () => {
  const { t } = useTranslation();
  const { agentConfig, updateAgentConfig, toggleTool, resetAgentConfig } = useAIStore();
  const [showAppTools, setShowAppTools] = useState(true);
  const [showExternalTools, setShowExternalTools] = useState(true);
  const [showPromptTemplates, setShowPromptTemplates] = useState(false);

  const handleNameChange = (e) => {
    updateAgentConfig({ name: e.target.value });
  };

  const handlePromptChange = (e) => {
    updateAgentConfig({ systemPrompt: e.target.value });
  };

  const applyTemplate = (template) => {
    updateAgentConfig({
      systemPrompt: template.prompt,
    });
    setShowPromptTemplates(false);
  };

  const getEnabledToolsCount = (tools, category) => {
    return tools.filter(tool => agentConfig[category]?.[tool.id]).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('ai.agent.customization')}</h2>
        <button
          onClick={resetAgentConfig}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <RefreshIcon className="w-4 h-4 mr-1" />
          {t('ai.agent.resetToDefault')}
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('ai.agent.customizationDescription')}
      </p>

      {/* Agent Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('ai.agent.agentName')}
        </label>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D97706] to-[#EA580C] flex items-center justify-center shadow-md shadow-orange-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <input
            type="text"
            value={agentConfig.name || ''}
            onChange={handleNameChange}
            placeholder="Travel Assistant"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 dark:text-white bg-white dark:bg-gray-700"
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {t('ai.agent.agentNameDescription')}
        </p>
      </div>

      {/* System Prompt / Personality */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('ai.agent.customInstructions')}
          </label>
          <button
            onClick={() => setShowPromptTemplates(!showPromptTemplates)}
            className="text-sm text-[#D97706] dark:text-orange-400 hover:text-[#B45309] dark:hover:text-orange-300 flex items-center"
          >
            <Wand2 className="w-4 h-4 mr-1" />
            {t('ai.agent.useTemplate')}
            {showPromptTemplates ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </button>
        </div>

        {/* Prompt Templates */}
        {showPromptTemplates && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('ai.agent.quickTemplates')}</p>
            <div className="grid grid-cols-1 gap-2">
              {PROMPT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="text-left p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t(template.nameKey)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t(template.descriptionKey)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={agentConfig.systemPrompt || ''}
          onChange={handlePromptChange}
          placeholder="Add custom instructions for the AI assistant... (e.g., 'Focus on budget-friendly options' or 'I prefer walking tours')"
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm resize-none"
        />
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {t('ai.agent.instructionsDescription')}
        </p>
      </div>

      {/* App Tools Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAppTools(!showAppTools)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center">
            <Wrench className="w-5 h-5 text-[#D97706] dark:text-orange-400 mr-3" />
            <div className="text-left">
              <p className="font-medium text-gray-900 dark:text-white">{t('ai.agent.travelAppTools')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('ai.agent.toolsEnabled', { enabled: getEnabledToolsCount(APP_TOOLS, 'appTools'), total: APP_TOOLS.length })}
              </p>
            </div>
          </div>
          {showAppTools ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showAppTools && (
          <div className="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-start p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
              <InfoCircleIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <span>{t('ai.agent.appToolsInfo')}</span>
            </div>
            {APP_TOOLS.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mr-3">
                    <tool.icon className="w-4 h-4 text-[#D97706] dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t(tool.nameKey)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t(tool.descriptionKey)}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleTool('appTools', tool.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    agentConfig.appTools?.[tool.id] !== false
                      ? 'bg-[#D97706]'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      agentConfig.appTools?.[tool.id] !== false ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* External Tools Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowExternalTools(!showExternalTools)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center">
            <GlobeIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-3" />
            <div className="text-left">
              <p className="font-medium text-gray-900 dark:text-white">{t('ai.agent.externalTools')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('ai.agent.toolsEnabled', { enabled: getEnabledToolsCount(EXTERNAL_TOOLS, 'externalTools'), total: EXTERNAL_TOOLS.length })}
              </p>
            </div>
          </div>
          {showExternalTools ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showExternalTools && (
          <div className="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-start p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-xs text-purple-700 dark:text-purple-300">
              <InfoCircleIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <span>{t('ai.agent.externalToolsInfo')}</span>
            </div>
            {EXTERNAL_TOOLS.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mr-3">
                    <tool.icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t(tool.nameKey)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t(tool.descriptionKey)}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleTool('externalTools', tool.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    agentConfig.externalTools?.[tool.id] !== false
                      ? 'bg-purple-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      agentConfig.externalTools?.[tool.id] !== false ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>{t('common.note')}:</strong> {t('ai.agent.settingsNote')}
        </p>
      </div>
    </div>
  );
};

export default AgentCustomizationSection;
