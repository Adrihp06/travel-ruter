import React, { createContext, useContext, useState, useMemo } from 'react';

const ItineraryUIContext = createContext(null);

export const ItineraryUIProvider = ({ children }) => {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isVaultVisible, setIsVaultVisible] = useState(false);

  const toggleSidebar = () => setIsSidebarVisible(prev => !prev);
  const toggleVault = () => setIsVaultVisible(prev => !prev);
  const showSidebar = () => setIsSidebarVisible(true);
  const hideSidebar = () => setIsSidebarVisible(false);
  const showVault = () => setIsVaultVisible(true);
  const hideVault = () => setIsVaultVisible(false);

  const value = useMemo(() => ({
    isSidebarVisible,
    isVaultVisible,
    toggleSidebar,
    toggleVault,
    showSidebar,
    hideSidebar,
    showVault,
    hideVault,
  }), [isSidebarVisible, isVaultVisible]);

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

export default ItineraryUIContext;
