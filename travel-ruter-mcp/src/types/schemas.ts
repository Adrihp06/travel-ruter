/**
 * TypeScript types matching the Travel-Ruter API schemas
 */

// ============================================================================
// Trip Types
// ============================================================================

export interface TripCreate {
  name: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  cover_image?: string;
  start_date: string; // ISO date format YYYY-MM-DD
  end_date: string;   // ISO date format YYYY-MM-DD
  total_budget?: number;
  currency?: string;  // Default: "USD", 3 chars
  status?: string;    // Default: "planning"
  tags?: string[];
}

export interface TripUpdate {
  name?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  cover_image?: string;
  start_date?: string;
  end_date?: string;
  total_budget?: number;
  currency?: string;
  status?: string;
  tags?: string[];
}

export interface TripResponse {
  id: number;
  name: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  cover_image?: string;
  start_date: string;
  end_date: string;
  total_budget?: number;
  currency: string;
  status: string;
  tags: string[];
  nights: number;
  created_at: string;
  updated_at: string;
}

export interface TripWithDestinationsResponse extends TripResponse {
  destinations: DestinationResponse[];
}

export interface DestinationBudget {
  destination_id: number;
  city_name: string;
  poi_estimated: number;
  poi_actual: number;
  accommodation_total: number;
  subtotal: number;
}

export interface BudgetSummary {
  total_budget: number;
  estimated_total: number;
  actual_total: number;
  remaining_budget: number;
  budget_percentage: number;
  poi_estimated: number;
  poi_actual: number;
  accommodation_total: number;
  by_destination: DestinationBudget[];
}

// ============================================================================
// Destination Types
// ============================================================================

export interface DestinationCreate {
  trip_id: number;
  city_name: string;
  country?: string;
  arrival_date: string;   // ISO date format YYYY-MM-DD
  departure_date: string; // ISO date format YYYY-MM-DD
  notes?: string;
  order_index?: number;
  name?: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface DestinationUpdate {
  city_name?: string;
  country?: string;
  arrival_date?: string;
  departure_date?: string;
  notes?: string;
  order_index?: number;
  name?: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface DestinationResponse {
  id: number;
  trip_id: number;
  city_name: string;
  country?: string;
  arrival_date: string;
  departure_date: string;
  notes?: string;
  order_index: number;
  name?: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

export interface DestinationReorderRequest {
  destination_ids: number[];
}

// ============================================================================
// POI Types
// ============================================================================

export interface POICreate {
  destination_id: number;
  name: string;
  category: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  estimated_cost?: number;
  actual_cost?: number;
  currency?: string;     // Default: "USD"
  dwell_time?: number;   // In minutes
  likes?: number;
  vetoes?: number;
  priority?: number;
  scheduled_date?: string; // ISO date format YYYY-MM-DD
  day_order?: number;
  files?: unknown[];
  metadata_json?: Record<string, unknown>;
  external_id?: string;
  external_source?: string;
}

export interface POIUpdate {
  name?: string;
  category?: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  estimated_cost?: number;
  actual_cost?: number;
  currency?: string;
  dwell_time?: number;
  likes?: number;
  vetoes?: number;
  priority?: number;
  scheduled_date?: string;
  day_order?: number;
  files?: unknown[];
  metadata_json?: Record<string, unknown>;
  external_id?: string;
  external_source?: string;
}

export interface POIResponse {
  id: number;
  destination_id: number;
  name: string;
  category: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  estimated_cost?: number;
  actual_cost?: number;
  currency: string;
  dwell_time?: number;
  likes: number;
  vetoes: number;
  priority: number;
  scheduled_date?: string;
  day_order?: number;
  files?: unknown[];
  metadata_json?: Record<string, unknown>;
  external_id?: string;
  external_source?: string;
  created_at: string;
  updated_at: string;
}

export interface POIsByCategory {
  category: string;
  pois: POIResponse[];
}

// ============================================================================
// Accommodation Types
// ============================================================================

export type AccommodationType = 'hotel' | 'hostel' | 'airbnb' | 'apartment' | 'resort' | 'guesthouse' | 'other';

export interface AccommodationCreate {
  destination_id: number;
  name: string;
  type: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  check_in_date: string;   // ISO date format YYYY-MM-DD
  check_out_date: string;  // ISO date format YYYY-MM-DD
  booking_reference?: string;
  booking_url?: string;
  total_cost?: number;
  currency?: string;       // Default: "USD"
  is_paid?: boolean;       // Default: false
  description?: string;
  contact_info?: Record<string, unknown>;
  amenities?: string[];
  files?: unknown[];
  rating?: number;         // 0-5.0
  review?: string;
}

export interface AccommodationUpdate {
  name?: string;
  type?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  check_in_date?: string;
  check_out_date?: string;
  booking_reference?: string;
  booking_url?: string;
  total_cost?: number;
  currency?: string;
  is_paid?: boolean;
  description?: string;
  contact_info?: Record<string, unknown>;
  amenities?: string[];
  files?: unknown[];
  rating?: number;
  review?: string;
}

export interface AccommodationResponse {
  id: number;
  destination_id: number;
  name: string;
  type: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  check_in_date: string;
  check_out_date: string;
  booking_reference?: string;
  booking_url?: string;
  total_cost?: number;
  currency: string;
  is_paid: boolean;
  description?: string;
  contact_info?: Record<string, unknown>;
  amenities?: string[];
  files?: unknown[];
  rating?: number;
  review?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Travel Segment Types
// ============================================================================

export type TravelMode = 'plane' | 'car' | 'train' | 'bus' | 'walk' | 'bike' | 'ferry';

export interface TravelSegmentCreate {
  from_destination_id: number;
  to_destination_id: number;
  travel_mode: TravelMode;
}

export interface TravelSegmentUpdate {
  travel_mode?: TravelMode;
}

export interface TravelSegmentResponse {
  id: number;
  from_destination_id: number;
  to_destination_id: number;
  travel_mode: TravelMode;
  distance_km?: number;
  duration_minutes?: number;
  route_geometry?: GeoJSONLineString;
  created_at: string;
  updated_at: string;
}

export interface TravelSegmentWithDestinations extends TravelSegmentResponse {
  from_city_name: string;
  to_city_name: string;
}

export interface TripTravelSegmentsResponse {
  segments: TravelSegmentResponse[];
}

export interface TravelSegmentCalculateRequest {
  travel_mode: TravelMode;
}

// ============================================================================
// GeoJSON Types
// ============================================================================

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface ApiError {
  detail: string;
}

// ============================================================================
// Geocoding Types
// ============================================================================

export interface GeocodingResult {
  place_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  type: string;
  importance: number;
}

// ============================================================================
// POI Suggestion Types
// ============================================================================

export interface POISuggestion {
  name: string;
  category: string;
  address?: string;
  latitude: number;
  longitude: number;
  external_id?: string;
  external_source?: string;
  metadata?: {
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    opening_hours?: { open_now?: boolean };
    business_status?: string;
  };
}

// ============================================================================
// Weather Types
// ============================================================================

export interface WeatherResponse {
  destination_id: number;
  city_name: string;
  month: number;
  month_name: string;
  average_temperature: number | null;
  temperature_unit: string;
  display_text: string;
}

// ============================================================================
// Hotel Types
// ============================================================================

export interface HotelPhoto {
  url: string;
  width?: number;
  height?: number;
}

export interface HotelSearchResult {
  place_id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  user_ratings_total?: number;
  photos: HotelPhoto[];
  types: string[];
}

export interface HotelSearchResponse {
  results: HotelSearchResult[];
  total: number;
}

export interface HotelReview {
  author_name?: string;
  rating?: number;
  text?: string;
  relative_time_description?: string;
}

export interface HotelDetailResult {
  place_id: string;
  name: string;
  address?: string;
  formatted_address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  user_ratings_total?: number;
  photos: HotelPhoto[];
  types: string[];
  website?: string;
  phone_number?: string;
  google_maps_url?: string;
  reviews: HotelReview[];
  opening_hours?: string[];
}

// ============================================================================
// Notes Types
// ============================================================================

export interface NoteCreate {
  title: string;
  content?: string;
  note_type?: 'general' | 'destination' | 'day' | 'poi';
  destination_id?: number;
  day_number?: number;
  poi_id?: number;
  is_pinned?: boolean;
  tags?: string[];
}

export interface NoteResponse {
  id: number;
  title: string;
  content?: string;
  note_type: string;
  trip_id: number;
  destination_id?: number;
  day_number?: number;
  poi_id?: number;
  is_pinned: boolean;
  tags: string[];
  media_files: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// POI Optimization Types
// ============================================================================

export interface OptimizedPOI {
  id: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  dwell_time: number;
  estimated_arrival: string;
  estimated_departure: string;
}

export interface POIOptimizationResponse {
  optimized_order: number[];
  total_distance_km: number;
  total_duration_minutes: number;
  original_order: number[];
  pois: POIResponse[];
  schedule: OptimizedPOI[];
  start_time: string;
}
