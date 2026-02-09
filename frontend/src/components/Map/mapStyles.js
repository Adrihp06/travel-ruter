/**
 * Custom Map Styles Configuration
 * Theme: Warm Explorer
 *
 * This module provides custom Mapbox styling that matches the app's
 * warm amber/terracotta/sage color palette.
 */

// Brand colors from design tokens
export const BRAND_COLORS = {
  primary: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  secondary: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
  },
  accent: {
    50: '#f7fee7',
    100: '#ecfccb',
    200: '#d9f99d',
    500: '#84cc16',
    600: '#65a30d',
    700: '#4d7c0f',
  },
  neutral: {
    50: '#fafaf9',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
  },
};

// POI Category Colors - Warm Explorer themed
export const POI_CATEGORY_COLORS = {
  accommodation: {
    bg: 'bg-sky-600',
    hover: 'hover:bg-sky-700',
    text: 'text-sky-600',
    hex: '#0284C7',
    light: '#e0f2fe',
  },
  food: {
    bg: 'bg-orange-600',
    hover: 'hover:bg-orange-700',
    text: 'text-orange-600',
    hex: '#EA580C',
    light: '#ffedd5',
  },
  sights: {
    bg: 'bg-lime-600',
    hover: 'hover:bg-lime-700',
    text: 'text-lime-600',
    hex: '#65A30D',
    light: '#ecfccb',
  },
  museums: {
    bg: 'bg-fuchsia-600',
    hover: 'hover:bg-fuchsia-700',
    text: 'text-fuchsia-600',
    hex: '#C026D3',
    light: '#fae8ff',
  },
  shopping: {
    bg: 'bg-rose-500',
    hover: 'hover:bg-rose-600',
    text: 'text-rose-600',
    hex: '#F43F5E',
    light: '#ffe4e6',
  },
  entertainment: {
    bg: 'bg-violet-600',
    hover: 'hover:bg-violet-700',
    text: 'text-violet-600',
    hex: '#7C3AED',
    light: '#ede9fe',
  },
  activities: {
    bg: 'bg-teal-600',
    hover: 'hover:bg-teal-700',
    text: 'text-teal-600',
    hex: '#0D9488',
    light: '#ccfbf1',
  },
  default: {
    bg: 'bg-amber-600',
    hover: 'hover:bg-amber-700',
    text: 'text-amber-700',
    hex: '#D97706',
    light: '#fef3c7',
  },
};

// Day route colors - vibrant but harmonious with brand
export const DAY_ROUTE_COLORS = [
  { stroke: '#D97706', name: 'Amber', light: '#fef3c7' },     // Day 1 - primary
  { stroke: '#65A30D', name: 'Lime', light: '#ecfccb' },      // Day 2 - accent green
  { stroke: '#EA580C', name: 'Orange', light: '#ffedd5' },    // Day 3 - terracotta
  { stroke: '#0D9488', name: 'Teal', light: '#ccfbf1' },      // Day 4 - nature
  { stroke: '#C026D3', name: 'Fuchsia', light: '#fae8ff' },   // Day 5 - vibrant
  { stroke: '#0284C7', name: 'Sky', light: '#e0f2fe' },       // Day 6 - sky blue
  { stroke: '#E11D48', name: 'Rose', light: '#ffe4e6' },      // Day 7 - warm rose
];

// Transport mode colors and styling
export const TRANSPORT_MODE_STYLES = {
  car: {
    color: '#D97706',  // Amber for car routes
    dasharray: null,
    icon: 'car',
  },
  driving: {
    color: '#D97706',  // Amber for driving routes
    dasharray: null,
    icon: 'car',
  },
  walk: {
    color: '#65A30D',  // Accent green
    dasharray: [1, 2],
    icon: 'footprints',
  },
  walking: {
    color: '#65A30D',
    dasharray: [1, 2],
    icon: 'footprints',
  },
  bike: {
    color: '#F59E0B',  // Light amber
    dasharray: [2, 1],
    icon: 'bike',
  },
  cycling: {
    color: '#F59E0B',
    dasharray: [2, 1],
    icon: 'bike',
  },
  train: {
    color: '#7C3AED',  // Violet
    dasharray: [4, 2],
    icon: 'train',
  },
  bus: {
    color: '#EA580C',  // Terracotta
    dasharray: [3, 2],
    icon: 'bus',
  },
  plane: {
    color: '#0284C7',  // Sky blue
    dasharray: [8, 4],
    icon: 'plane',
  },
  flight: {
    color: '#0284C7',
    dasharray: [8, 4],
    icon: 'plane',
  },
  ferry: {
    color: '#0D9488',  // Teal
    dasharray: [6, 3],
    icon: 'ship',
  },
};

// Custom map style - Warm Explorer theme
// This applies color overlays to the default Mapbox streets style
export const MAP_STYLE_CONFIG = {
  // Base style URL
  baseStyle: 'mapbox://styles/mapbox/streets-v12',

  // Style overrides for a warmer feel
  overrides: [
    // Water - softer blue
    {
      id: 'water',
      type: 'fill',
      paint: {
        'fill-color': '#b4d4e1',
      },
    },
    // Parks - sage green tint
    {
      id: 'landuse-park',
      type: 'fill',
      paint: {
        'fill-color': '#d4e6c3',
      },
    },
    // Buildings - warm stone
    {
      id: 'building',
      type: 'fill',
      paint: {
        'fill-color': '#e7e5e4',
        'fill-opacity': 0.8,
      },
    },
  ],
};

// Marker styles
export const MARKER_STYLES = {
  // Destination marker (numbered)
  destination: {
    size: 'w-9 h-9',
    bg: 'bg-amber-600',
    hoverBg: 'bg-amber-700',
    selectedBg: 'bg-amber-800',
    border: 'border-2 border-white',
    shadow: 'shadow-lg',
    text: 'text-white font-bold text-sm',
    ring: 'ring-4 ring-amber-400/50',
  },
  // POI marker
  poi: {
    scheduled: {
      shape: 'rounded-lg',
      border: 'border-2 border-white',
      shadow: 'shadow-lg',
    },
    unscheduled: {
      shape: 'rounded-full',
      border: 'border border-white/80',
      shadow: 'shadow-md',
    },
    dayBadge: {
      size: 'w-5 h-5',
      bg: 'bg-white',
      text: 'text-xs font-bold text-stone-700',
      shadow: 'shadow-md',
      border: 'border border-stone-200',
    },
  },
  // Cluster marker
  cluster: {
    minSize: 40,
    maxSize: 64,
    border: 'border-4 border-white',
    shadow: 'shadow-xl',
    text: 'text-white font-bold',
  },
  // Origin point marker
  origin: {
    size: 'w-10 h-10',
    bg: 'bg-green-500',
    border: 'border-2 border-white',
    shadow: 'shadow-lg',
    icon: 'plane',
  },
  // Return point marker
  return: {
    size: 'w-10 h-10',
    bg: 'bg-rose-500',
    border: 'border-2 border-white',
    shadow: 'shadow-lg',
    icon: 'home',
  },
  // Searched place marker
  searched: {
    size: 'w-11 h-11',
    bg: 'bg-amber-600',
    border: 'border-4 border-white',
    shadow: 'shadow-2xl',
    animation: 'animate-bounce',
  },
};

// Route line styles
export const ROUTE_STYLES = {
  // Main route between destinations
  main: {
    width: 4,
    opacity: 0.85,
    outlineWidth: 6,
    outlineColor: '#ffffff',
    outlineOpacity: 0.5,
  },
  // Selected/highlighted route
  selected: {
    width: 6,
    opacity: 1,
    outlineWidth: 10,
    outlineOpacity: 0.7,
  },
  // Dimmed route (when another is selected)
  dimmed: {
    width: 3,
    opacity: 0.4,
    outlineWidth: 5,
    outlineOpacity: 0.3,
  },
  // Origin/return dotted lines
  originReturn: {
    width: 3,
    opacity: 0.7,
    dasharray: [2, 4],
    outlineWidth: 5,
    outlineOpacity: 0.4,
  },
};

// Popup styles
export const POPUP_STYLES = {
  container: {
    maxWidth: '300px',
    minWidth: '200px',
    borderRadius: '12px',
    shadow: 'shadow-xl',
  },
  header: {
    iconSize: 'w-4 h-4',
    titleSize: 'text-sm font-semibold',
    categorySize: 'text-xs font-medium',
  },
  body: {
    textSize: 'text-xs',
    spacing: 'space-y-1.5',
  },
  actions: {
    buttonSize: 'px-2 py-1',
    iconSize: 'w-3 h-3',
  },
};

// Legend styles
export const LEGEND_STYLES = {
  container: {
    bg: 'bg-white/95',
    backdrop: 'backdrop-blur-sm',
    border: 'border border-stone-200',
    shadow: 'shadow-lg',
    radius: 'rounded-xl',
    maxWidth: 'max-w-[220px]',
  },
  header: {
    padding: 'px-3 py-2.5',
    iconColor: 'text-stone-500',
    textSize: 'text-xs font-semibold text-stone-700',
  },
  item: {
    padding: 'p-2',
    iconSize: 'w-3 h-3',
    textSize: 'text-xs text-stone-600',
    activeHighlight: 'bg-amber-50',
    inactiveOpacity: 'opacity-50',
  },
};

// Control button styles
export const CONTROL_BUTTON_STYLES = {
  primary: {
    bg: 'bg-amber-600',
    hoverBg: 'hover:bg-amber-700',
    text: 'text-white',
    shadow: 'shadow-lg',
    radius: 'rounded-lg',
  },
  secondary: {
    bg: 'bg-white',
    hoverBg: 'hover:bg-stone-50',
    text: 'text-stone-700',
    border: 'border border-stone-200',
    shadow: 'shadow-lg',
    radius: 'rounded-lg',
  },
  danger: {
    bg: 'bg-rose-500',
    hoverBg: 'hover:bg-rose-600',
    text: 'text-white',
    shadow: 'shadow-lg',
    radius: 'rounded-lg',
  },
};

// Map control positioning
export const CONTROL_POSITIONS = {
  navigation: 'top-right',
  scale: 'bottom-left',
  fullscreen: 'top-right',
  geolocate: 'top-right',
  addPoi: 'top-3 right-14',
  legend: 'bottom-8 left-3',
  routeControls: 'top-3 left-3',
  routeSummary: 'bottom-3 left-3',
  googleMapsExport: 'bottom-3 right-3',
};

/**
 * Get category colors by category name
 */
export const getCategoryColors = (category) => {
  const normalizedCategory = category?.toLowerCase() || '';

  if (normalizedCategory.includes('accommodation') ||
      normalizedCategory.includes('hotel') ||
      normalizedCategory.includes('stay')) {
    return POI_CATEGORY_COLORS.accommodation;
  }
  if (normalizedCategory.includes('food') ||
      normalizedCategory.includes('restaurant') ||
      normalizedCategory.includes('dining') ||
      normalizedCategory.includes('cafe')) {
    return POI_CATEGORY_COLORS.food;
  }
  if (normalizedCategory.includes('sight') ||
      normalizedCategory.includes('attraction') ||
      normalizedCategory.includes('landmark') ||
      normalizedCategory.includes('monument')) {
    return POI_CATEGORY_COLORS.sights;
  }
  if (normalizedCategory.includes('museum') ||
      normalizedCategory.includes('gallery') ||
      normalizedCategory.includes('historic')) {
    return POI_CATEGORY_COLORS.museums;
  }
  if (normalizedCategory.includes('shop') ||
      normalizedCategory.includes('market') ||
      normalizedCategory.includes('store')) {
    return POI_CATEGORY_COLORS.shopping;
  }
  if (normalizedCategory.includes('entertainment') ||
      normalizedCategory.includes('nightlife') ||
      normalizedCategory.includes('bar')) {
    return POI_CATEGORY_COLORS.entertainment;
  }
  if (normalizedCategory.includes('sport') ||
      normalizedCategory.includes('activity') ||
      normalizedCategory.includes('outdoor')) {
    return POI_CATEGORY_COLORS.activities;
  }

  return POI_CATEGORY_COLORS.default;
};

/**
 * Get day route color by index
 */
export const getDayRouteColor = (dayIndex) => {
  return DAY_ROUTE_COLORS[dayIndex % DAY_ROUTE_COLORS.length];
};

/**
 * Get transport mode style
 */
export const getTransportModeStyle = (mode) => {
  return TRANSPORT_MODE_STYLES[mode] || TRANSPORT_MODE_STYLES.car;
};

/**
 * Calculate cluster marker size based on point count
 */
export const getClusterSize = (pointCount) => {
  const { minSize, maxSize } = MARKER_STYLES.cluster;
  const size = Math.min(minSize + (pointCount / 5) * 4, maxSize);
  return size;
};

export default {
  BRAND_COLORS,
  POI_CATEGORY_COLORS,
  DAY_ROUTE_COLORS,
  TRANSPORT_MODE_STYLES,
  MAP_STYLE_CONFIG,
  MARKER_STYLES,
  ROUTE_STYLES,
  POPUP_STYLES,
  LEGEND_STYLES,
  CONTROL_BUTTON_STYLES,
  CONTROL_POSITIONS,
  getCategoryColors,
  getDayRouteColor,
  getTransportModeStyle,
  getClusterSize,
};
