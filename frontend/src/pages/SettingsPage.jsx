import React, { useState, useEffect } from 'react';
import { User, Map, DollarSign, Sun, Moon, Download, Upload, Save, Check } from 'lucide-react';
import Breadcrumbs from '../components/Layout/Breadcrumbs';

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
  currency: {
    default: 'USD',
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
  const [activeSection, setActiveSection] = useState('profile');

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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    // If mapbox token is set, also store it separately for the MapboxContext
    if (settings.map.mapboxToken) {
      localStorage.setItem('mapbox-access-token', settings.map.mapboxToken);
    }

    setSavedMessage('Settings saved successfully!');
    setTimeout(() => setSavedMessage(''), 3000);
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

  const toggleTheme = () => {
    const newMode = settings.theme.mode === 'light' ? 'dark' : 'light';
    updateSetting('theme', 'mode', newMode);
  };

  const sections = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'map', name: 'Map Settings', icon: Map },
    { id: 'currency', name: 'Currency', icon: DollarSign },
    { id: 'theme', name: 'Theme', icon: settings.theme.mode === 'light' ? Sun : Moon },
    { id: 'export', name: 'Export/Import', icon: Download },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8 pt-24 relative overflow-y-auto">
      <div className="absolute top-6 left-6 z-50">
        <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100">
          <Breadcrumbs className="mb-0" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <button
            onClick={saveSettings}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Save className="w-5 h-5" />
            <span>Save Settings</span>
          </button>
        </div>

        {savedMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
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
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <section.icon className="w-5 h-5 mr-3" />
                  {section.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {/* Profile Settings */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={settings.profile.name}
                    onChange={(e) => updateSetting('profile', 'name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={settings.profile.email}
                    onChange={(e) => updateSetting('profile', 'email', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    value={settings.profile.avatar}
                    onChange={(e) => updateSetting('profile', 'avatar', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    placeholder="https://example.com/avatar.jpg"
                  />
                  {settings.profile.avatar && (
                    <div className="mt-3">
                      <img
                        src={settings.profile.avatar}
                        alt="Avatar preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
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
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Map Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mapbox Access Token
                  </label>
                  <input
                    type="text"
                    value={settings.map.mapboxToken}
                    onChange={(e) => updateSetting('map', 'mapboxToken', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm text-gray-900 bg-white"
                    placeholder="pk.eyJ1Ijoi..."
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Get your token from{' '}
                    <a
                      href="https://account.mapbox.com/access-tokens/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700"
                    >
                      Mapbox Account
                    </a>
                  </p>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> After saving your Mapbox token, you may need to refresh
                    the page for maps to load with the new token.
                  </p>
                </div>
              </div>
            )}

            {/* Currency Settings */}
            {activeSection === 'currency' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Currency Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Currency
                  </label>
                  <select
                    value={settings.currency.default}
                    onChange={(e) => updateSetting('currency', 'default', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
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

            {/* Theme Settings */}
            {activeSection === 'theme' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Theme Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Appearance
                  </label>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => updateSetting('theme', 'mode', 'light')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        settings.theme.mode === 'light'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                      <span>Light</span>
                    </button>
                    <button
                      onClick={() => updateSetting('theme', 'mode', 'dark')}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        settings.theme.mode === 'dark'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Moon className="w-5 h-5" />
                      <span>Dark</span>
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">
                    Dark mode support coming soon. Your preference will be saved.
                  </p>
                </div>
              </div>
            )}

            {/* Export/Import Settings */}
            {activeSection === 'export' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Export & Import</h2>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-2">Export Settings</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Download a backup of your settings and preferences.
                  </p>
                  <button
                    onClick={handleExport}
                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    <span>Export Backup</span>
                  </button>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-2">Import Settings</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Restore settings from a previously exported backup file.
                  </p>
                  <label className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer w-fit">
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

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
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
