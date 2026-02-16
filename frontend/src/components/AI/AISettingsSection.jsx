/**
 * AISettingsSection - Settings section for AI assistant configuration
 * Used in the Settings page
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Key } from 'lucide-react';
import RefreshIcon from '@/components/icons/refresh-icon';
import CheckedIcon from '@/components/icons/checked-icon';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import useAIStore from '../../stores/useAIStore';
import authFetch from '../../utils/authFetch';

const _RAW_ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';
// Resolve relative paths (e.g. "/chat") to an absolute URL for fetch calls
const ORCHESTRATOR_URL = _RAW_ORCHESTRATOR_URL.startsWith('http')
  ? _RAW_ORCHESTRATOR_URL
  : `${window.location.origin}${_RAW_ORCHESTRATOR_URL}`;

// Provider info for display (no key input — keys are managed per-trip)
const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic (Claude)', models: ['Claude Opus 4.6', 'Claude Sonnet 4.5', 'Claude Haiku 4.5'] },
  { id: 'openai', name: 'OpenAI', models: ['GPT-5.2', 'GPT-5.2 Codex', 'o3', 'o4-mini', 'GPT-4.1'] },
  { id: 'google', name: 'Google (Gemini)', models: ['Gemini 3 Flash', 'Gemini 3 Pro', 'Gemini 2.5 Pro', 'Gemini 2.5 Flash'] },
  { id: 'perplexity', name: 'Perplexity AI (POI Search)', models: ['Sonar', 'Sonar Pro'] },
];

const AISettingsSection = ({ settings, updateSetting }) => {
  const { t } = useTranslation();
  const { models, selectedModelId, selectModel, modelsLoading, initialize, connectionError } = useAIStore();
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [testMessage, setTestMessage] = useState('');
  const [providerStatus, setProviderStatus] = useState({});

  // Initialize models on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load provider status on mount
  useEffect(() => {
    const loadProviderStatus = async () => {
      try {
        const response = await authFetch(`${ORCHESTRATOR_URL}/api/providers/status`);
        if (response.ok) {
          const data = await response.json();
          setProviderStatus(data.providers || {});
        }
      } catch {
        // ignore
      }
    };
    loadProviderStatus();
  }, []);

  // Test connection to orchestrator
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Testing connection...');

    try {
      const response = await authFetch(`${ORCHESTRATOR_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setTestStatus('success');
        setTestMessage(`Connected! Orchestrator v${data.version}`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage(`Connection failed: ${error.message}`);
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      setTestStatus(null);
      setTestMessage('');
    }, 5000);
  };

  // Handle model selection — persists as user default
  const handleModelChange = (modelId) => {
    selectModel(modelId);
    updateSetting('ai', 'defaultModel', modelId);
  };

  // Handle enable/disable toggle
  const handleEnableToggle = (enabled) => {
    updateSetting('ai', 'enabled', enabled);
  };

  // Group models by provider
  const groupedModels = models.reduce((groups, model) => {
    const provider = model.provider || 'other';
    if (!groups[provider]) groups[provider] = [];
    groups[provider].push(model);
    return groups;
  }, {});

  const providerLabels = {
    claude: 'Claude (Anthropic)',
    openai: 'OpenAI',
    gemini: 'Gemini (Google)',
    ollama: 'Ollama (Local)',
    other: 'Other',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('ai.settings.title')}</h2>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('ai.settings.description')}
      </p>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-3">
          <Bot className="w-6 h-6 text-[#D97706] dark:text-amber-400" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{t('ai.settings.enableAssistant')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ai.settings.enableDescription')}</p>
          </div>
        </div>
        <button
          onClick={() => handleEnableToggle(!settings.ai?.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.ai?.enabled !== false
              ? 'bg-[#D97706]'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.ai?.enabled !== false ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* API Keys — managed per-trip */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Key className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('ai.settings.apiKeys')}</h3>
        </div>

        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-2">
            API keys are now managed per-trip
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            AI provider keys (Anthropic, OpenAI, Google AI) and service keys (Mapbox, OpenRouteService) are stored
            securely at the trip level and shared among trip members. Go to your trip settings to add or manage API keys.
          </p>
        </div>

        {/* Provider status overview */}
        <div className="grid grid-cols-2 gap-3">
          {PROVIDERS.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{provider.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {provider.models.slice(0, 2).join(', ')}{provider.models.length > 2 ? '...' : ''}
                </p>
              </div>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                providerStatus[provider.id]
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {providerStatus[provider.id] ? 'Active' : 'No key'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Orchestrator URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('ai.settings.orchestratorUrl')}
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={settings.ai?.orchestratorUrl || ORCHESTRATOR_URL}
            onChange={(e) => updateSetting('ai', 'orchestratorUrl', e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] font-mono text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            placeholder="http://localhost:3001"
          />
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            {testStatus === 'testing' ? (
              <RefreshIcon className="w-5 h-5 animate-spin" />
            ) : (
              t('ai.settings.test')
            )}
          </button>
        </div>
        {testMessage && (
          <p className={`mt-2 text-sm flex items-center ${
            testStatus === 'success' ? 'text-green-600 dark:text-green-400' :
            testStatus === 'error' ? 'text-red-600 dark:text-red-400' :
            'text-gray-600 dark:text-gray-400'
          }`}>
            {testStatus === 'success' && <CheckedIcon className="w-4 h-4 mr-1" />}
            {testStatus === 'error' && <InfoCircleIcon className="w-4 h-4 mr-1" />}
            {testMessage}
          </p>
        )}
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t('ai.settings.orchestratorUrlDescription')}
        </p>
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('ai.settings.defaultModel')}
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {t('ai.settings.defaultModelHint')}
        </p>
        {modelsLoading ? (
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <RefreshIcon className="w-4 h-4 animate-spin" />
            <span>{t('ai.settings.loadingModels')}</span>
          </div>
        ) : connectionError ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>{t('common.note')}:</strong> {t('ai.settings.connectionError', { url: ORCHESTRATOR_URL })}
            </p>
          </div>
        ) : models.length === 0 ? (
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('ai.settings.noModels')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <div key={provider} className="space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {providerLabels[provider] || provider}
                </p>
                <div className="space-y-2">
                  {providerModels.map((model) => (
                    <label
                      key={model.id}
                      className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedModelId === model.id
                          ? 'border-[#D97706] bg-amber-50 dark:bg-amber-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="aiModel"
                        value={model.id}
                        checked={selectedModelId === model.id}
                        onChange={() => handleModelChange(model.id)}
                        className="mt-0.5 h-4 w-4 text-[#D97706] focus:ring-[#D97706]/50 border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          {model.name}
                          {selectedModelId === model.id && (
                            <span className="ml-2 text-xs bg-[#D97706] text-white px-1.5 py-0.5 rounded">{t('ai.settings.yourDefault')}</span>
                          )}
                          {model.isDefault && selectedModelId !== model.id && (
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">({t('ai.settings.providerDefault')})</span>
                          )}
                        </span>
                        {model.description && (
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {model.description}
                          </span>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          {model.supportsStreaming && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                              {t('ai.settings.streaming')}
                            </span>
                          )}
                          {model.supportsTools && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                              {t('ai.settings.tools')}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>{t('ai.settings.availableProviders')}</strong>
        </p>
        <ul className="mt-2 text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li><strong>Claude:</strong> {t('ai.settings.providerClaude')}</li>
          <li><strong>OpenAI:</strong> {t('ai.settings.providerOpenAI')}</li>
          <li><strong>Gemini:</strong> {t('ai.settings.providerGemini')}</li>
          <li><strong>Ollama:</strong> {t('ai.settings.providerOllama')}</li>
          <li><strong>Perplexity:</strong> {t('ai.settings.providerPerplexity', 'Powers intelligent POI search with web-sourced travel recommendations')}</li>
        </ul>
        <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
          {t('ai.settings.addApiKeysHint')}
        </p>
      </div>
    </div>
  );
};

export default AISettingsSection;
