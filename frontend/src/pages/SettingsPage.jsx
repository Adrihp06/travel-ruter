import React, { useState, useEffect } from 'react';
import { User, Map, DollarSign, Sun, Moon, Monitor, Download, Upload, Save, Check, Route, Calendar } from 'lucide-react';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import { useTheme } from '../contexts/ThemeContext';
import { dateLocales } from '../utils/dateFormat';
import Spinner from '../components/UI/Spinner';

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
  currency: {
    default: 'USD',
  },
  dateFormat: {
    locale: '', // Empty string means use browser default
  },
  theme: {
    mode: 'light',
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
  const [settings, setSettings] = useState(defaultSettings);
  const [savedMessage, setSavedMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const { themeMode, setThemeMode, isDark } = useTheme();

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

  // Save settings to localStorage
  const saveSettings = () => {
    setIsSaving(true);
    
    // Simulate API call/processing time
    setTimeout(() => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      // If mapbox token is set, also store it separately for the MapboxContext
      if (settings.map.mapboxToken) {
        localStorage.setItem('mapbox-access-token', settings.map.mapboxToken);
      }

      setSavedMessage('Settings saved successfully!');
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
          setSavedMessage('Settings imported successfully!');
          setTimeout(() => setSavedMessage(''), 3000);
        }
      } catch {
        alert('Invalid backup file format');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleThemeChange = (mode) => {
    setThemeMode(mode);
    updateSetting('theme', 'mode', mode);
  };

  const getThemeIcon = () => {
    if (themeMode === 'system') return Monitor;
    return isDark ? Moon : Sun;
  };

  const sections = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'map', name: 'Map Settings', icon: Map },
    { id: 'routing', name: 'Routing', icon: Route },
    { id: 'currency', name: 'Currency', icon: DollarSign },
    { id: 'dateFormat', name: 'Date Format', icon: Calendar },
    { id: 'theme', name: 'Theme', icon: getThemeIcon() },
    { id: 'export', name: 'Export/Import', icon: Download },
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? <Spinner className="text-white" /> : <Save className="w-5 h-5" />}
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>

        {savedMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center text-green-700 dark:text-green-300">
            <Check className="w-5 h-5 mr-2" />
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
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
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
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Profile Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={settings.profile.name}
                    onChange={(e) => updateSetting('profile', 'name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={settings.profile.email}
                    onChange={(e) => updateSetting('profile', 'email', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    value={settings.profile.avatar}
                    onChange={(e) => updateSetting('profile', 'avatar', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    placeholder="https://example.com/avatar.jpg"
                  />
                  {settings.profile.avatar && (
                    <div className="mt-3">
                      <img
                        src={settings.profile.avatar}
                        alt="Avatar preview"
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
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Map Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mapbox Access Token
                  </label>
                  <input
                    type="text"
                    value={settings.map.mapboxToken}
                    onChange={(e) => updateSetting('map', 'mapboxToken', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    placeholder="pk.eyJ1Ijoi..."
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Get your token from{' '}
                    <a
                      href="https://account.mapbox.com/access-tokens/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      Mapbox Account
                    </a>
                  </p>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Note:</strong> After saving your Mapbox token, you may need to refresh
                    the page for maps to load with the new token.
                  </p>
                </div>
              </div>
            )}

            {/* Routing Settings */}
            {activeSection === 'routing' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Routing Settings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure which routing service to use for calculating routes between destinations.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    Routing Service Preference
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                      <input
                        type="radio"
                        name="routingPreference"
                        value="default"
                        checked={settings.routing?.preference === 'default'}
                        onChange={(e) => updateSetting('routing', 'preference', e.target.value)}
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          Default (OpenRouteService)
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          Use OpenRouteService for all routing. Train/bus routes use road geometry as approximation.
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
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          Google Maps for Public Transport Only
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          Use Google Maps Routes API for train/bus routes (shows actual rail/bus geometry). Other modes use OpenRouteService.
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
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          Google Maps for Everything
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          Use Google Maps Routes API for all transport modes (car, train, bus, walk, bike).
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Google Maps API Key
                  </label>
                  <input
                    type="text"
                    value={settings.routing?.googleMapsApiKey || ''}
                    onChange={(e) => updateSetting('routing', 'googleMapsApiKey', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    placeholder="AIza..."
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Get your API key from{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      Google Cloud Console
                    </a>
                    . Enable the "Routes API" for your project.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Note:</strong> Google Maps Routes API requires billing to be enabled but includes
                    a free tier. If no API key is configured, the system falls back to OpenRouteService.
                  </p>
                </div>

                {(settings.routing?.preference === 'google_public_transport' ||
                  settings.routing?.preference === 'google_everything') &&
                  !settings.routing?.googleMapsApiKey && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      <strong>Warning:</strong> You have selected a Google Maps routing option but haven't
                      provided an API key. Routes will fall back to OpenRouteService.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Currency Settings */}
            {activeSection === 'currency' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Currency Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Currency
                  </label>
                  <select
                    value={settings.currency.default}
                    onChange={(e) => updateSetting('currency', 'default', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
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
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Date Format Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date Locale
                  </label>
                  <select
                    value={settings.dateFormat?.locale || ''}
                    onChange={(e) => updateSetting('dateFormat', 'locale', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Auto (Browser Default)</option>
                    {dateLocales.map((locale) => (
                      <option key={locale.code} value={locale.code}>
                        {locale.name} - {locale.example}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Choose how dates are displayed throughout the application.
                    &quot;Auto&quot; uses your browser&apos;s language settings.
                  </p>
                </div>
              </div>
            )}

            {/* Theme Settings */}
            {activeSection === 'theme' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Theme Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    Appearance
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleThemeChange('light')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        themeMode === 'light'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-300'
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                      <span>Light</span>
                    </button>
                    <button
                      onClick={() => handleThemeChange('dark')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        themeMode === 'dark'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-300'
                      }`}
                    >
                      <Moon className="w-5 h-5" />
                      <span>Dark</span>
                    </button>
                    <button
                      onClick={() => handleThemeChange('system')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        themeMode === 'system'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-300'
                      }`}
                    >
                      <Monitor className="w-5 h-5" />
                      <span>System</span>
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Choose your preferred appearance. System will follow your device settings.
                  </p>
                </div>
              </div>
            )}

            {/* Export/Import Settings */}
            {activeSection === 'export' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Export & Import</h2>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Export Settings</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Download a backup of your settings and preferences.
                  </p>
                  <button
                    onClick={handleExport}
                    className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors text-gray-900 dark:text-white"
                  >
                    <Download className="w-5 h-5" />
                    <span>Export Backup</span>
                  </button>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Import Settings</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Restore settings from a previously exported backup file.
                  </p>
                  <label className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors cursor-pointer w-fit text-gray-900 dark:text-white">
                    <Upload className="w-5 h-5" />
                    <span>Import Backup</span>
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
                    <strong>Note:</strong> Importing will overwrite your current settings.
                    Make sure to export a backup first if needed.
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
