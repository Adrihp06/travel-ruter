import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Wand2 } from 'lucide-react';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import AISettingsSection from '../components/AI/AISettingsSection';
import AgentCustomizationSection from '../components/AI/AgentCustomizationSection';

const SETTINGS_KEY = 'travel-ruter-settings';

const AISettingsPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('assistant');

  // Load/save settings for the AI toggle & orchestrator URL
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const updateSetting = (section, key, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        [section]: { ...prev[section], [key]: value },
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const tabs = [
    { id: 'assistant', label: t('settings.sections.ai'), icon: Bot },
    { id: 'agent', label: t('settings.sections.agentCustomization'), icon: Wand2 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 pt-24 relative overflow-y-auto transition-colors">
      <div className="absolute top-6 left-6 z-50">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <Breadcrumbs className="mb-0" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D97706] to-[#EA580C] flex items-center justify-center shadow-md shadow-orange-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('ai.settingsPage.title')}
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#D97706] text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors">
          {activeTab === 'assistant' && (
            <AISettingsSection settings={settings} updateSetting={updateSetting} />
          )}
          {activeTab === 'agent' && (
            <AgentCustomizationSection />
          )}
        </div>
      </div>
    </div>
  );
};

export default AISettingsPage;
