import { TravelTimeResponse } from '../types';

interface GoogleMapsDistanceMatrixResponse {
  status: string;
  rows: Array<{
    elements: Array<{
      status: string;
      duration: {
        value: number;
        text: string;
      };
      distance: {
        value: number;
        text: string;
      };
    }>;
  }>;
}

export class TravelTimeService {
  private googleMapsApiKey: string | undefined;

  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  async calculateTravelTime(origin: string, destination: string): Promise<TravelTimeResponse> {
    if (!this.googleMapsApiKey) {
      return this.getMockTravelTime(origin, destination);
    }

    try {
      // Using Google Maps Distance Matrix API
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${this.googleMapsApiKey}&mode=driving`;
      
      const response = await fetch(url);
      const data = await response.json() as GoogleMapsDistanceMatrixResponse;

      if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
        const element = data.rows[0].elements[0];
        return {
          duration: Math.ceil(element.duration.value / 60), // Convert seconds to minutes
          distance: element.distance.text,
          route: `${origin} to ${destination}`
        };
      }

      return this.getMockTravelTime(origin, destination);
    } catch (error) {
      console.error('Error calculating travel time:', error);
      return this.getMockTravelTime(origin, destination);
    }
  }

  private getMockTravelTime(origin: string, destination: string): TravelTimeResponse {
    // Simple mock based on Portland area assumptions
    const zones = {
      'downtown': ['123 Oak St', 'downtown', 'pearl', 'northwest'],
      'southeast': ['456 Pine Ave', 'southeast', 'division', 'hawthorne'],
      'northeast': ['789 Elm St', 'northeast', 'alberta', 'fremont'],
      'southwest': ['321 Maple Dr', 'southwest', 'burlingame', 'hillsdale']
    };

    const getZone = (address: string) => {
      const addressLower = address.toLowerCase();
      for (const [zone, keywords] of Object.entries(zones)) {
        if (keywords.some(keyword => addressLower.includes(keyword))) {
          return zone;
        }
      }
      return 'unknown';
    };

    const originZone = getZone(origin);
    const destZone = getZone(destination);

    let duration = 15; // Default 15 minutes
    let distance = '5.2 miles';

    if (originZone === destZone) {
      // Same zone - shorter travel time
      duration = 10;
      distance = '2.1 miles';
    } else if (originZone !== 'unknown' && destZone !== 'unknown') {
      // Different zones - longer travel time
      duration = 25;
      distance = '8.7 miles';
    }

    return {
      duration,
      distance,
      route: `${origin} to ${destination}`
    };
  }
} 