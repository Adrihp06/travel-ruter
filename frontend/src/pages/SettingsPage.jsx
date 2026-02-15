import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Map, Sun, Monitor, Download, Upload, Save, Route, Calendar, Key } from 'lucide-react';
import CurrencyDollarIcon from '@/components/icons/currency-dollar-icon';
import MoonIcon from '@/components/icons/moon-icon';
import CheckedIcon from '@/components/icons/checked-icon';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import GlobeIcon from '@/components/icons/globe-icon';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import { useTheme } from '../contexts/ThemeContext';
import { dateLocales, invalidateLocaleCache } from '../utils/dateFormat';
import Spinner from '../components/UI/Spinner';
import ApiKeySettings from '../components/Settings/ApiKeySettings';
import useTripStore from '../stores/useTripStore';
import useAuthStore from '../stores/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const SETTINGS_KEY = 'travel-ruter-settings';

const defaultSettings = {
  profile: {
    name: '',
    email: '',
    avatar: '',
  },
  map: {
    mapboxToken: '',
  },
  routing: {
    preference: 'default', // 'default', 'google_public_transport', 'google_everything'
    googleMapsApiKey: '',
  },
  geocoding: {
    provider: 'nominatim', // 'nominatim' or 'mapbox'
  },
  currency: {
    default: 'USD',
  },
  dateFormat: {
    locale: '', // Empty string means use browser default
  },
  language: {
    current: 'en',
  },
  theme: {
    mode: 'light',
  },
  ai: {
    enabled: true,
    orchestratorUrl: '',
    defaultModel: '',
  },
};

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
];

const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState(defaultSettings);
  const [savedMessage, setSavedMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const { themeMode, setThemeMode, isDark } = useTheme();
  const { tripsWithDestinations } = useTripStore();
  const { user: authUser, isAuthenticated } = useAuthStore();
  const [selectedApiKeyTripId, setSelectedApiKeyTripId] = useState('');

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  // Sync profile from OAuth when authenticated
  useEffect(() => {
    if (isAuthenticated && authUser) {
      setSettings((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          name: authUser.name || prev.profile.name,
          email: authUser.email || prev.profile.email,
          avatar: authUser.avatar_url || prev.profile.avatar,
        },
      }));
    }
  }, [isAuthenticated, authUser]);

  // Save settings to localStorage
  const saveSettings = () => {
    setIsSaving(true);
    
    // Simulate API call/processing time
    setTimeout(() => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      // Invalidate cached date locale so new format takes effect immediately
      invalidateLocaleCache();

      // If mapbox token is set, also store it separately for the MapboxContext
      if (settings.map.mapboxToken) {
        localStorage.setItem('mapbox-access-token', settings.map.mapboxToken);
      }

      setSavedMessage(t('settings.settingsSaved'));
      setIsSaving(false);
      setTimeout(() => setSavedMessage(''), 3000);
    }, 600);
  };

  // Update nested settings
  const updateSetting = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  // Export all trips data
  const handleExport = () => {
    const dataToExport = {
      settings,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel-ruter-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import data from file
  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result);
        if (imported.settings) {
          setSettings({ ...defaultSettings, ...imported.settings });
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(imported.settings));
          setSavedMessage(t('settings.settingsImported'));
          setTimeout(() => setSavedMessage(''), 3000);
        }
      } catch {
        alert(t('settings.invalidBackup'));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleThemeChange = (mode) => {
    setThemeMode(mode);
    updateSetting('theme', 'mode', mode);
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    updateSetting('language', 'current', lang);
    // Also persist to the dedicated localStorage key for i18n detector
    localStorage.setItem('travel-ruter-language', lang);
  };

  const getThemeIcon = () => {
    if (themeMode === 'system') return Monitor;
    return isDark ? MoonIcon : Sun;
  };

  const sections = [
    { id: 'profile', name: t('settings.sections.profile'), icon: User },
    { id: 'map', name: t('settings.sections.map'), icon: Map },
    { id: 'routing', name: t('settings.sections.routing'), icon: Route },
    { id: 'geocoding', name: t('settings.sections.geocoding'), icon: MagnifierIcon },
    { id: 'currency', name: t('settings.sections.currency'), icon: CurrencyDollarIcon },
    { id: 'dateFormat', name: t('settings.sections.dateFormat'), icon: Calendar },
    { id: 'language', name: t('settings.sections.language'), icon: GlobeIcon },
    { id: 'theme', name: t('settings.sections.theme'), icon: getThemeIcon() },
    { id: 'apiKeys', name: t('settings.sections.apiKeys'), icon: Key },
    { id: 'export', name: t('settings.sections.export'), icon: Download },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 pt-24 relative overflow-y-auto transition-colors">
      <div className="absolute top-6 left-6 z-50">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <Breadcrumbs className="mb-0" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="flex items-center space-x-2 px-4 py-2 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? <Spinner className="text-white" /> : <Save className="w-5 h-5" />}
            <span>{isSaving ? t('common.saving') : t('settings.saveSettings')}</span>
          </button>
        </div>

        {savedMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center text-green-700 dark:text-green-300">
            <CheckedIcon className="w-5 h-5 mr-2" />
            {savedMessage}
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-48 flex-shrink-0">
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeSection === section.id
                      ? 'bg-amber-50 dark:bg-amber-900/30 text-[#D97706] dark:text-amber-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <section.icon className="w-5 h-5 mr-3" />
                  {section.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors">
            {/* Profile Settings */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.profile.title')}</h2>
                {isAuthenticated && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      <strong>Signed in via Google.</strong> Name and email are managed by your Google account.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.profile.name')}
                  </label>
                  <input
                    type="text"
                    value={settings.profile.name}
                    onChange={(e) => updateSetting('profile', 'name', e.target.value)}
                    readOnly={isAuthenticated}
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${isAuthenticated ? 'opacity-60 cursor-not-allowed' : ''}`}
                    placeholder={t('settings.profile.namePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.profile.email')}
                  </label>
                  <input
                    type="email"
                    value={settings.profile.email}
                    onChange={(e) => updateSetting('profile', 'email', e.target.value)}
                    readOnly={isAuthenticated}
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${isAuthenticated ? 'opacity-60 cursor-not-allowed' : ''}`}
                    placeholder={t('settings.profile.emailPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.profile.avatarUrl')}
                  </label>
                  <input
                    type="url"
                    value={settings.profile.avatar}
                    onChange={(e) => updateSetting('profile', 'avatar', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    placeholder={t('settings.profile.avatarPlaceholder')}
                  />
                  {settings.profile.avatar && (
                    <div className="mt-3">
                      <img
                        src={settings.profile.avatar}
                        alt={t('settings.profile.avatarPreview')}
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Map Settings */}
            {activeSection === 'map' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.map.title')}</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.map.mapboxToken')}
                  </label>
                  <input
                    type="text"
                    value={settings.map.mapboxToken}
                    onChange={(e) => updateSetting('map', 'mapboxToken', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] font-mono text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    placeholder={t('settings.map.mapboxTokenPlaceholder')}
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.map.getToken')}{' '}
                    <a
                      href="https://account.mapbox.com/access-tokens/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#D97706] dark:text-amber-400 hover:text-[#B45309] dark:hover:text-amber-300"
                    >
                      {t('settings.map.mapboxAccount')}
                    </a>
                  </p>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Note:</strong> {t('settings.map.refreshNote')}
                  </p>
                </div>
              </div>
            )}

            {/* Routing Settings */}
            {activeSection === 'routing' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.routing.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('settings.routing.description')}
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    {t('settings.routing.preference')}
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                      <input
                        type="radio"
                        name="routingPreference"
                        value="default"
                        checked={settings.routing?.preference === 'default'}
                        onChange={(e) => updateSetting('routing', 'preference', e.target.value)}
                        className="mt-1 h-4 w-4 text-[#D97706] focus:ring-[#D97706] border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          {t('settings.routing.defaultOrs')}
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          {t('settings.routing.defaultOrsDesc')}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                      <input
                        type="radio"
                        name="routingPreference"
                        value="google_public_transport"
                        checked={settings.routing?.preference === 'google_public_transport'}
                        onChange={(e) => updateSetting('routing', 'preference', e.target.value)}
                        className="mt-1 h-4 w-4 text-[#D97706] focus:ring-[#D97706] border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          {t('settings.routing.googlePublicTransport')}
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          {t('settings.routing.googlePublicTransportDesc')}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                      <input
                        type="radio"
                        name="routingPreference"
                        value="google_everything"
                        checked={settings.routing?.preference === 'google_everything'}
                        onChange={(e) => updateSetting('routing', 'preference', e.target.value)}
                        className="mt-1 h-4 w-4 text-[#D97706] focus:ring-[#D97706] border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          {t('settings.routing.googleEverything')}
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          {t('settings.routing.googleEverythingDesc')}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.routing.googleApiKey')}
                  </label>
                  <input
                    type="text"
                    value={settings.routing?.googleMapsApiKey || ''}
                    onChange={(e) => updateSetting('routing', 'googleMapsApiKey', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] font-mono text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    placeholder={t('settings.routing.googleApiKeyPlaceholder')}
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.routing.getApiKey')}{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#D97706] dark:text-amber-400 hover:text-[#B45309] dark:hover:text-amber-300"
                    >
                      {t('settings.routing.googleConsole')}
                    </a>
                    . {t('settings.routing.enableRoutesApi')}
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Note:</strong> {t('settings.routing.googleBillingNote')}
                  </p>
                </div>

                {(settings.routing?.preference === 'google_public_transport' ||
                  settings.routing?.preference === 'google_everything') &&
                  !settings.routing?.googleMapsApiKey && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      <strong>Warning:</strong> {t('settings.routing.googleNoKeyWarning')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Geocoding Settings */}
            {activeSection === 'geocoding' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.geocoding.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('settings.geocoding.description')}
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    {t('settings.geocoding.provider')}
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                      <input
                        type="radio"
                        name="geocodingProvider"
                        value="nominatim"
                        checked={settings.geocoding?.provider === 'nominatim'}
                        onChange={(e) => updateSetting('geocoding', 'provider', e.target.value)}
                        className="mt-1 h-4 w-4 text-[#D97706] focus:ring-[#D97706] border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          {t('settings.geocoding.nominatim')}
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          {t('settings.geocoding.nominatimDesc')}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                      <input
                        type="radio"
                        name="geocodingProvider"
                        value="mapbox"
                        checked={settings.geocoding?.provider === 'mapbox'}
                        onChange={(e) => updateSetting('geocoding', 'provider', e.target.value)}
                        className="mt-1 h-4 w-4 text-[#D97706] focus:ring-[#D97706] border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          {t('settings.geocoding.mapbox')}
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          {t('settings.geocoding.mapboxDesc')}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {settings.geocoding?.provider === 'mapbox' && !settings.map?.mapboxToken && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      <strong>Warning:</strong> {t('settings.geocoding.noTokenWarning')}
                    </p>
                  </div>
                )}

                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Note:</strong> {t('settings.geocoding.cacheNote')}
                  </p>
                </div>
              </div>
            )}

            {/* Currency Settings */}
            {activeSection === 'currency' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.currency.title')}</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.currency.default')}
                  </label>
                  <select
                    value={settings.currency.default}
                    onChange={(e) => updateSetting('currency', 'default', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Date Format Settings */}
            {activeSection === 'dateFormat' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.dateFormat.title')}</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.dateFormat.locale')}
                  </label>
                  <select
                    value={settings.dateFormat?.locale || ''}
                    onChange={(e) => updateSetting('dateFormat', 'locale', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">{t('settings.dateFormat.auto')}</option>
                    {dateLocales.map((locale) => (
                      <option key={locale.code} value={locale.code}>
                        {locale.name} - {locale.example}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.dateFormat.description')}
                  </p>
                </div>
              </div>
            )}

            {/* Language Settings */}
            {activeSection === 'language' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.language.title')}</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    {t('settings.language.select')}
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleLanguageChange('en')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        i18n.language === 'en' || i18n.language?.startsWith('en')
                          ? 'border-[#D97706] bg-amber-50 text-[#D97706] dark:bg-amber-900/30 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-lg">🇬🇧</span>
                      <span>English</span>
                    </button>
                    <button
                      onClick={() => handleLanguageChange('es')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        i18n.language === 'es' || i18n.language?.startsWith('es')
                          ? 'border-[#D97706] bg-amber-50 text-[#D97706] dark:bg-amber-900/30 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-lg">🇪🇸</span>
                      <span>Español</span>
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.language.description')}
                  </p>
                </div>
              </div>
            )}

            {/* Theme Settings */}
            {activeSection === 'theme' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.theme.title')}</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    {t('settings.theme.appearance')}
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleThemeChange('light')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        themeMode === 'light'
                          ? 'border-[#D97706] bg-amber-50 text-[#D97706] dark:bg-amber-900/30 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-300'
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                      <span>{t('settings.theme.light')}</span>
                    </button>
                    <button
                      onClick={() => handleThemeChange('dark')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        themeMode === 'dark'
                          ? 'border-[#D97706] bg-amber-50 text-[#D97706] dark:bg-amber-900/30 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-300'
                      }`}
                    >
                      <MoonIcon className="w-5 h-5" />
                      <span>{t('settings.theme.dark')}</span>
                    </button>
                    <button
                      onClick={() => handleThemeChange('system')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        themeMode === 'system'
                          ? 'border-[#D97706] bg-amber-50 text-[#D97706] dark:bg-amber-900/30 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-300'
                      }`}
                    >
                      <Monitor className="w-5 h-5" />
                      <span>{t('settings.theme.system')}</span>
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.theme.description')}
                  </p>
                </div>
              </div>
            )}

            {/* API Keys Settings */}
            {activeSection === 'apiKeys' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.sections.apiKeys')}</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trips.title')}
                  </label>
                  <select
                    value={selectedApiKeyTripId}
                    onChange={(e) => setSelectedApiKeyTripId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">{t('ai.selectTripToStart')}</option>
                    {tripsWithDestinations.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title || trip.name || t('trips.untitledTrip')}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedApiKeyTripId && (
                  <ApiKeySettings tripId={Number(selectedApiKeyTripId)} />
                )}
              </div>
            )}

            {/* Export/Import Settings */}
            {activeSection === 'export' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('settings.exportImport.title')}</h2>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">{t('settings.exportImport.exportTitle')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t('settings.exportImport.exportDescription')}
                  </p>
                  <button
                    onClick={handleExport}
                    className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors text-gray-900 dark:text-white"
                  >
                    <Download className="w-5 h-5" />
                    <span>{t('settings.exportImport.exportBackup')}</span>
                  </button>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">{t('settings.exportImport.importTitle')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t('settings.exportImport.importDescription')}
                  </p>
                  <label className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors cursor-pointer w-fit text-gray-900 dark:text-white">
                    <Upload className="w-5 h-5" />
                    <span>{t('settings.exportImport.importBackup')}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Note:</strong> {t('settings.exportImport.importWarning')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
