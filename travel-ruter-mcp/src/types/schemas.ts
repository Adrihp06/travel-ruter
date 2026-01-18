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

export interface BudgetSummary {
  total_budget: number;
  estimated_total: number;
  actual_total: number;
  remaining_budget: number;
  budget_percentage: number;
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
