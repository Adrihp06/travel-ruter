import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

const ItineraryUIContext = createContext(null);

export const ItineraryUIProvider = ({ children }) => {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isVaultVisible, setIsVaultVisible] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isJournalVisible, setIsJournalVisible] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState('list'); // 'list' | 'map'

  const toggleSidebar = useCallback(() => setIsSidebarVisible(prev => !prev), []);
  const toggleVault = useCallback(() => setIsVaultVisible(prev => {
    if (!prev) setIsJournalVisible(false); // close journal when opening vault
    return !prev;
  }), []);
  const toggleCalendar = useCallback(() => setIsCalendarVisible(prev => !prev), []);
  const toggleJournal = useCallback(() => setIsJournalVisible(prev => {
    if (!prev) setIsVaultVisible(false); // close vault when opening journal
    return !prev;
  }), []);
  const showSidebar = useCallback(() => setIsSidebarVisible(true), []);
  const hideSidebar = useCallback(() => setIsSidebarVisible(false), []);
  const showVault = useCallback(() => { setIsJournalVisible(false); setIsVaultVisible(true); }, []);
  const hideVault = useCallback(() => setIsVaultVisible(false), []);
  const showCalendar = useCallback(() => setIsCalendarVisible(true), []);
  const hideCalendar = useCallback(() => setIsCalendarVisible(false), []);
  const showJournal = useCallback(() => { setIsVaultVisible(false); setIsJournalVisible(true); }, []);
  const hideJournal = useCallback(() => setIsJournalVisible(false), []);

  const value = useMemo(() => ({
    isSidebarVisible,
    isVaultVisible,
    isCalendarVisible,
    isJournalVisible,
    toggleSidebar,
    toggleVault,
    toggleCalendar,
    toggleJournal,
    showSidebar,
    hideSidebar,
    showVault,
    hideVault,
    showCalendar,
    hideCalendar,
    showJournal,
    hideJournal,
    mobileActiveTab,
    setMobileActiveTab,
  }), [isSidebarVisible, isVaultVisible, isCalendarVisible, isJournalVisible, mobileActiveTab,
      toggleSidebar, toggleVault, toggleCalendar, toggleJournal,
      showSidebar, hideSidebar, showVault, hideVault, showCalendar, hideCalendar, showJournal, hideJournal]);

  return (
    <ItineraryUIContext.Provider value={value}>
      {children}
    </ItineraryUIContext.Provider>
  );
};

export const useItineraryUI = () => {
  const context = useContext(ItineraryUIContext);
  if (!context) {
    throw new Error('useItineraryUI must be used within ItineraryUIProvider');
  }
  return context;
};

export const sidebarAnimationClasses = {
  hidden: 'transform -translate-x-full opacity-0',
  visible: 'transform translate-x-0 opacity-100',
  transition: 'transition-all duration-300 ease-in-out'
};

export const vaultAnimationClasses = {
  hidden: 'transform translate-x-full opacity-0',
  visible: 'transform translate-x-0 opacity-100',
  transition: 'transition-all duration-300 ease-in-out'
};

export const calendarAnimationClasses = {
  hidden: 'transform translate-x-full opacity-0',
  visible: 'transform translate-x-0 opacity-100',
  transition: 'transition-all duration-300 ease-in-out'
};

export default ItineraryUIContext;
