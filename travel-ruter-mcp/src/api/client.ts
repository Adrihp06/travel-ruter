/**
 * HTTP client for Travel-Ruter API
 */

import type {
  TripCreate,
  TripUpdate,
  TripResponse,
  TripWithDestinationsResponse,
  BudgetSummary,
  DestinationCreate,
  DestinationUpdate,
  DestinationResponse,
  DestinationReorderRequest,
  POICreate,
  POIUpdate,
  POIResponse,
  POIsByCategory,
  AccommodationCreate,
  AccommodationUpdate,
  AccommodationResponse,
  TravelSegmentResponse,
  TravelSegmentCalculateRequest,
  TripTravelSegmentsResponse,
} from '../types/schemas.js';

export class TravelRuterClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.TRAVEL_RUTER_API_URL || 'http://localhost:8000/api/v1';
    // Remove trailing slash if present
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    // Add query parameters
    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errorBody = await response.json() as { detail?: string };
        if (errorBody && typeof errorBody.detail === 'string') {
          errorDetail = errorBody.detail;
        }
      } catch {
        // If we can't parse JSON, use status text
        errorDetail = response.statusText || errorDetail;
      }
      throw new Error(errorDetail);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // Trip Methods
  // ============================================================================

  async createTrip(data: TripCreate): Promise<TripResponse> {
    return this.request<TripResponse>('POST', '/trips/', data);
  }

  async listTrips(params?: {
    status?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<TripResponse[]> {
    return this.request<TripResponse[]>('GET', '/trips/', undefined, params);
  }

  async getTrip(tripId: number): Promise<TripWithDestinationsResponse> {
    return this.request<TripWithDestinationsResponse>('GET', `/trips/${tripId}`);
  }

  async updateTrip(tripId: number, data: TripUpdate): Promise<TripResponse> {
    return this.request<TripResponse>('PUT', `/trips/${tripId}`, data);
  }

  async deleteTrip(tripId: number): Promise<void> {
    return this.request<void>('DELETE', `/trips/${tripId}`);
  }

  async getTripBudget(tripId: number): Promise<BudgetSummary> {
    return this.request<BudgetSummary>('GET', `/trips/${tripId}/budget`);
  }

  // ============================================================================
  // Destination Methods
  // ============================================================================

  async createDestination(data: DestinationCreate): Promise<DestinationResponse> {
    return this.request<DestinationResponse>('POST', '/destinations', data);
  }

  async listDestinations(tripId: number): Promise<DestinationResponse[]> {
    return this.request<DestinationResponse[]>('GET', `/trips/${tripId}/destinations`);
  }

  async getDestination(destinationId: number): Promise<DestinationResponse> {
    return this.request<DestinationResponse>('GET', `/destinations/${destinationId}`);
  }

  async updateDestination(destinationId: number, data: DestinationUpdate): Promise<DestinationResponse> {
    return this.request<DestinationResponse>('PUT', `/destinations/${destinationId}`, data);
  }

  async deleteDestination(destinationId: number): Promise<void> {
    return this.request<void>('DELETE', `/destinations/${destinationId}`);
  }

  async reorderDestinations(tripId: number, data: DestinationReorderRequest): Promise<DestinationResponse[]> {
    return this.request<DestinationResponse[]>('POST', `/trips/${tripId}/destinations/reorder`, data);
  }

  // ============================================================================
  // POI Methods
  // ============================================================================

  async createPOI(data: POICreate): Promise<POIResponse> {
    return this.request<POIResponse>('POST', '/pois', data);
  }

  async listPOIs(destinationId: number): Promise<POIsByCategory[]> {
    return this.request<POIsByCategory[]>('GET', `/destinations/${destinationId}/pois`);
  }

  async getPOI(poiId: number): Promise<POIResponse> {
    return this.request<POIResponse>('GET', `/pois/${poiId}`);
  }

  async updatePOI(poiId: number, data: POIUpdate): Promise<POIResponse> {
    return this.request<POIResponse>('PUT', `/pois/${poiId}`, data);
  }

  async deletePOI(poiId: number): Promise<void> {
    return this.request<void>('DELETE', `/pois/${poiId}`);
  }

  // ============================================================================
  // Accommodation Methods
  // ============================================================================

  async createAccommodation(data: AccommodationCreate): Promise<AccommodationResponse> {
    return this.request<AccommodationResponse>('POST', '/accommodations', data);
  }

  async listAccommodations(destinationId: number): Promise<AccommodationResponse[]> {
    return this.request<AccommodationResponse[]>('GET', `/destinations/${destinationId}/accommodations`);
  }

  async getAccommodation(accommodationId: number): Promise<AccommodationResponse> {
    return this.request<AccommodationResponse>('GET', `/accommodations/${accommodationId}`);
  }

  async updateAccommodation(accommodationId: number, data: AccommodationUpdate): Promise<AccommodationResponse> {
    return this.request<AccommodationResponse>('PUT', `/accommodations/${accommodationId}`, data);
  }

  async deleteAccommodation(accommodationId: number): Promise<void> {
    return this.request<void>('DELETE', `/accommodations/${accommodationId}`);
  }

  // ============================================================================
  // Travel Segment Methods
  // ============================================================================

  async calculateTravelSegment(
    fromDestinationId: number,
    toDestinationId: number,
    data: TravelSegmentCalculateRequest
  ): Promise<TravelSegmentResponse> {
    return this.request<TravelSegmentResponse>(
      'POST',
      `/destinations/${fromDestinationId}/travel-segment/${toDestinationId}`,
      data
    );
  }

  async getTravelSegment(
    fromDestinationId: number,
    toDestinationId: number
  ): Promise<TravelSegmentResponse> {
    return this.request<TravelSegmentResponse>(
      'GET',
      `/destinations/${fromDestinationId}/travel-segment/${toDestinationId}`
    );
  }

  async getTripTravelSegments(tripId: number): Promise<TripTravelSegmentsResponse> {
    return this.request<TripTravelSegmentsResponse>('GET', `/trips/${tripId}/travel-segments`);
  }

  async recalculateTravelSegments(tripId: number): Promise<TripTravelSegmentsResponse> {
    return this.request<TripTravelSegmentsResponse>('POST', `/trips/${tripId}/travel-segments/recalculate`);
  }

  async deleteTravelSegment(segmentId: number): Promise<void> {
    return this.request<void>('DELETE', `/travel-segments/${segmentId}`);
  }
}

// Singleton instance
let clientInstance: TravelRuterClient | null = null;

export function getClient(): TravelRuterClient {
  if (!clientInstance) {
    clientInstance = new TravelRuterClient();
  }
  return clientInstance;
}

export function resetClient(): void {
  clientInstance = null;
}
