import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const ThemeContext = createContext(null);

const SETTINGS_KEY = 'travel-ruter-settings';

const getStoredThemeMode = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.theme?.mode || 'system';
    }
  } catch {
    // Invalid JSON, ignore
  }
  return 'system';
};

const getSystemPreference = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

const updateStoredThemeMode = (mode) => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    const settings = stored ? JSON.parse(stored) : {};
    settings.theme = { ...settings.theme, mode };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage error, ignore
  }
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeModeState] = useState(() => getStoredThemeMode());
  const [systemPreference, setSystemPreference] = useState(() => getSystemPreference());

  // Compute the effective theme (resolves 'system' to actual light/dark)
  const effectiveTheme = useMemo(() => {
    if (themeMode === 'system') {
      return systemPreference;
    }
    return themeMode;
  }, [themeMode, systemPreference]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply dark class to document element
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  // Set theme mode and persist to localStorage
  const setThemeMode = useCallback((mode) => {
    setThemeModeState(mode);
    updateStoredThemeMode(mode);
  }, []);

  const value = useMemo(() => ({
    themeMode,        // 'light', 'dark', or 'system'
    effectiveTheme,   // Always 'light' or 'dark'
    setThemeMode,
    isDark: effectiveTheme === 'dark',
  }), [themeMode, effectiveTheme, setThemeMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
