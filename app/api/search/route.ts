// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface UserLocation {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  rating?: string;
  address?: string;
  phone?: string;
  distance?: string;
  category?: string;
  openingHours?: string;
  priceLevel?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface GeoapifyPlace {
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    formatted?: string;
    place_id?: string;
    categories?: string[];
    details?: string[];
    datasource?: {
      sourcename?: string;
      attribution?: string;
      license?: string;
      url?: string;
    };
    distance?: number;
    phone?: string;
    website?: string;
    opening_hours?: string;
    rating?: number;
    price_level?: number;
  };
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
}

interface GeoapifyResponse {
  type: string;
  features: GeoapifyPlace[];
  query?: any;
}

interface SearchRequestBody {
  query: string;
  userLocation?: UserLocation | null;
  searchDepth?: string;
  maxResults?: number;
}

// Helper function to calculate distance between coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

// Map Geoapify categories to user-friendly categories
function mapCategory(categories: string[] = []): string {
  const categoryMap: { [key: string]: string } = {
    'accommodation': 'Hotel',
    'commercial': 'Business',
    'commercial.food_and_drink': 'Restaurant',
    'commercial.food_and_drink.restaurant': 'Restaurant',
    'commercial.food_and_drink.cafe': 'Restaurant',
    'commercial.food_and_drink.fast_food': 'Restaurant',
    'commercial.food_and_drink.bar': 'Restaurant',
    'commercial.food_and_drink.pub': 'Restaurant',
    'commercial.shopping': 'Shopping',
    'commercial.supermarket': 'Shopping',
    'commercial.marketplace': 'Shopping',
    'healthcare': 'Healthcare',
    'healthcare.hospital': 'Healthcare',
    'healthcare.clinic': 'Healthcare',
    'healthcare.pharmacy': 'Healthcare',
    'healthcare.dentist': 'Healthcare',
    'healthcare.veterinary': 'Healthcare',
    'service': 'Services',
    'service.automotive': 'Automotive',
    'service.financial': 'Services',
    'service.beauty': 'Services',
    'entertainment': 'Entertainment',
    'entertainment.cinema': 'Entertainment',
    'entertainment.nightclub': 'Entertainment',
    'tourism': 'Entertainment',
    'tourism.attraction': 'Entertainment',
    'sport': 'Entertainment',
    'education': 'Education',
    'building': 'Business',
    'parking': 'Parking',
    'fuel': 'Gas Station'
  };

  // Find the most specific category match
  for (const category of categories) {
    if (categoryMap[category]) {
      return categoryMap[category];
    }
  }

  // Check for partial matches
  for (const category of categories) {
    for (const [key, value] of Object.entries(categoryMap)) {
      if (key.includes(category) || category.includes(key)) {
        return value;
      }
    }
  }

  return 'Business';
}

// Format price level
function formatPriceLevel(level?: number): string | undefined {
  if (level === undefined || level === null) return undefined;
  
  const priceMap: { [key: number]: string } = {
    1: '$',
    2: '$$',
    3: '$$$',
    4: '$$$$'
  };
  
  return priceMap[level] || undefined;
}

// Format opening hours
function formatOpeningHours(hours?: string): string | undefined {
  if (!hours) return undefined;
  
  // Basic formatting - you can enhance this based on Geoapify's format
  if (hours.toLowerCase().includes('24/7') || hours.toLowerCase().includes('24 hours')) {
    return '24 hours';
  }
  
  return hours.length > 50 ? hours.substring(0, 50) + '...' : hours;
}

// Generate website URL for the business
function generateWebsiteUrl(place: GeoapifyPlace): string {
  const props = place.properties;
  
  // If we have a direct website, use it
  if (props.website) {
    return props.website;
  }
  
  // If we have a place_id, create a Google Maps link as fallback
  if (props.place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${props.place_id}`;
  }
  
  // Create a Google Maps search link
  const coords = place.geometry.coordinates;
  const name = props.name || 'Business';
  const query = encodeURIComponent(`${name} ${props.formatted || ''}`);
  
  return `https://www.google.com/maps/search/?api=1&query=${query}&center=${coords[1]},${coords[0]}`;
}

// Main search function using Geoapify
async function searchWithGeoapify(query: string, userLocation: UserLocation | null): Promise<SearchResult[]> {
  try {
    const API_KEY = process.env.GEOAPIFY_API_KEY;
    
    if (!API_KEY) {
      throw new Error('GEOAPIFY_API_KEY not found in environment variables');
    }

    // Build search parameters
    const params = new URLSearchParams({
      text: query.trim(),
      apiKey: API_KEY,
      limit: '20',
      format: 'geojson'
    });

    // Add location bias if user location is available
    if (userLocation) {
      params.append('bias', `proximity:${userLocation.lng},${userLocation.lat}`);
      params.append('filter', `circle:${userLocation.lng},${userLocation.lat},10000`); // 10km radius
    }

    console.log('Geoapify search query:', query);
    console.log('Search URL:', `https://api.geoapify.com/v1/geocode/search?${params.toString()}`);

    const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Geoapify API error:', response.status, errorText);
      throw new Error(`Geoapify API error: ${response.status} ${response.statusText}`);
    }

    const data: GeoapifyResponse = await response.json();
    console.log('Geoapify API response:', JSON.stringify(data, null, 2));

    if (!data.features || data.features.length === 0) {
      console.log('No results from Geoapify, trying Places API...');
      return await searchPlacesWithGeoapify(query, userLocation);
    }

    // Process the results
    const results: SearchResult[] = data.features
      .map((place: GeoapifyPlace) => {
        const props = place.properties;
        const coords = place.geometry.coordinates; // [lng, lat]
        
        // Build address
        const addressParts = [
          props.housenumber,
          props.street,
          props.city,
          props.state,
          props.postcode
        ].filter(Boolean);
        const address = addressParts.length > 0 ? addressParts.join(', ') : props.formatted;

        // Calculate distance
        let distance: string | undefined;
        if (userLocation) {
          const dist = calculateDistance(userLocation.lat, userLocation.lng, coords[1], coords[0]);
          distance = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
        }

        // Generate snippet
        const category = mapCategory(props.categories);
        let snippet = `${category} located in ${props.city || 'the area'}`;
        if (props.details && props.details.length > 0) {
          snippet += `. ${props.details.join('. ')}`;
        }
        if (distance) {
          snippet += ` Located ${distance} away.`;
        }

        return {
          title: props.name || 'Local Business',
          url: generateWebsiteUrl(place),
          snippet: snippet,
          rating: props.rating ? props.rating.toString() : undefined,
          address: address,
          phone: props.phone,
          distance: distance,
          category: category,
          openingHours: formatOpeningHours(props.opening_hours),
          priceLevel: formatPriceLevel(props.price_level),
          coordinates: {
            lat: coords[1],
            lng: coords[0]
          }
        };
      })
      .filter((result: SearchResult) => {
        // Filter out results that don't seem like businesses
        return result.title && 
               result.title !== 'Local Business' && 
               result.title.length > 2 &&
               !result.title.toLowerCase().includes('unnamed road') &&
               !result.title.toLowerCase().includes('street') &&
               result.category !== 'Education'; // Optional: filter out schools
      });

    return results.slice(0, 8);

  } catch (error) {
    console.error('Geoapify search error:', error);
    throw error;
  }
}

// Alternative search using Geoapify Places API for better business results
async function searchPlacesWithGeoapify(query: string, userLocation: UserLocation | null): Promise<SearchResult[]> {
  try {
    const API_KEY = process.env.GEOAPIFY_API_KEY;
    
    if (!API_KEY) {
      throw new Error('GEOAPIFY_API_KEY not found in environment variables');
    }

    // Build search parameters for Places API
    const params = new URLSearchParams({
      categories: getGeoapifyCategories(query),
      apiKey: API_KEY,
      limit: '20',
      format: 'geojson'
    });

    // Add location if available
    if (userLocation) {
      params.append('filter', `circle:${userLocation.lng},${userLocation.lat},10000`); // 10km radius
      params.append('bias', `proximity:${userLocation.lng},${userLocation.lat}`);
    }

    // Add text filter if it's not a generic category search
    if (!isGenericCategory(query)) {
      params.append('name', query);
    }

    console.log('Geoapify Places API query:', query);
    console.log('Places URL:', `https://api.geoapify.com/v2/places?${params.toString()}`);

    const response = await fetch(`https://api.geoapify.com/v2/places?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Geoapify Places API error:', response.status, errorText);
      throw new Error(`Geoapify Places API error: ${response.status} ${response.statusText}`);
    }

    const data: GeoapifyResponse = await response.json();
    console.log('Geoapify Places API response:', JSON.stringify(data, null, 2));

    if (!data.features || data.features.length === 0) {
      return [];
    }

    // Process the results (similar to above but with Places API specific handling)
    const results: SearchResult[] = data.features
      .map((place: GeoapifyPlace) => {
        const props = place.properties;
        const coords = place.geometry.coordinates; // [lng, lat]
        
        const addressParts = [
          props.housenumber,
          props.street,
          props.city,
          props.state
        ].filter(Boolean);
        const address = addressParts.length > 0 ? addressParts.join(', ') : props.formatted;

        let distance: string | undefined;
        if (userLocation) {
          const dist = calculateDistance(userLocation.lat, userLocation.lng, coords[1], coords[0]);
          distance = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
        }

        const category = mapCategory(props.categories);
        let snippet = `${category}`;
        if (props.city) snippet += ` in ${props.city}`;
        if (address) snippet += `. Address: ${address}`;
        if (props.phone) snippet += ` Call: ${props.phone}`;

        return {
          title: props.name || `${category} Business`,
          url: generateWebsiteUrl(place),
          snippet: snippet,
          rating: props.rating ? props.rating.toString() : undefined,
          address: address,
          phone: props.phone,
          distance: distance,
          category: category,
          openingHours: formatOpeningHours(props.opening_hours),
          priceLevel: formatPriceLevel(props.price_level),
          coordinates: {
            lat: coords[1],
            lng: coords[0]
          }
        };
      })
      .filter((result: SearchResult) => {
        return result.title && result.title.length > 2;
      });

    return results.slice(0, 8);

  } catch (error) {
    console.error('Geoapify Places search error:', error);
    return [];
  }
}

// Map search queries to Geoapify categories
function getGeoapifyCategories(query: string): string {
  const queryLower = query.toLowerCase();
  
  const categoryMap: { [key: string]: string } = {
    'restaurant': 'catering.restaurant',
    'restaurants': 'catering.restaurant',
    'food': 'catering',
    'coffee': 'catering.cafe',
    'cafe': 'catering.cafe',
    'bar': 'catering.bar',
    'pub': 'catering.pub',
    'fast food': 'catering.fast_food',
    'gas station': 'service.fuel',
    'fuel': 'service.fuel',
    'petrol': 'service.fuel',
    'hospital': 'healthcare.hospital',
    'clinic': 'healthcare.clinic',
    'doctor': 'healthcare',
    'pharmacy': 'healthcare.pharmacy',
    'hotel': 'accommodation.hotel',
    'motel': 'accommodation.motel',
    'shopping': 'commercial.shopping_mall',
    'store': 'commercial',
    'supermarket': 'commercial.supermarket',
    'grocery': 'commercial.supermarket',
    'bank': 'commercial.bank',
    'atm': 'service.financial.bank',
    'gym': 'sport.fitness',
    'fitness': 'sport.fitness'
  };

  // Find matching categories
  const matchedCategories: string[] = [];
  
  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (queryLower.includes(keyword)) {
      matchedCategories.push(category);
    }
  }

  // Return matched categories or default to commercial
  return matchedCategories.length > 0 ? matchedCategories.join(',') : 'commercial';
}

// Check if query is a generic category search
function isGenericCategory(query: string): boolean {
  const genericTerms = [
    'restaurants', 'food', 'coffee shops', 'gas stations', 'hospitals', 
    'hotels', 'shopping', 'stores', 'pharmacies', 'banks', 'gyms'
  ];
  
  return genericTerms.some(term => query.toLowerCase().includes(term));
}

// Fallback function (keep your existing one but simplified)
function getSampleLocalBusinesses(location: UserLocation | null, query: string): SearchResult[] {
  const samples: SearchResult[] = [
    {
      title: "Joe's Coffee House",
      url: "https://example.com",
      snippet: "Local coffee shop serving fresh brewed coffee, pastries, and light meals. Free WiFi and cozy atmosphere.",
      rating: "4.3",
      address: "123 Main Street",
      phone: "(555) 123-4567",
      category: "Restaurant",
      openingHours: "Mon-Fri 6:00 AM - 8:00 PM",
      distance: location ? "0.3 km" : undefined
    },
    {
      title: "QuickMart Grocery",
      url: "https://example.com",
      snippet: "Full-service grocery store with fresh produce, meat, dairy, and household essentials.",
      rating: "4.1",
      address: "456 Oak Avenue",
      phone: "(555) 987-6543",
      category: "Shopping",
      openingHours: "Daily 7:00 AM - 11:00 PM",
      distance: location ? "0.7 km" : undefined
    }
  ];

  return samples.filter(business => 
    business.title.toLowerCase().includes(query.toLowerCase()) ||
    business.category.toLowerCase().includes(query.toLowerCase())
  );
}

// Main POST handler
export async function POST(request: NextRequest) {
  try {
    const body: SearchRequestBody = await request.json();
    const { query, userLocation, maxResults = 8 } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ 
        error: 'Search query is required and must be a non-empty string' 
      }, { status: 400 });
    }

    console.log('Search request:', { query, userLocation, maxResults });

    try {
      // Try Geoapify search
      const results = await searchWithGeoapify(query, userLocation);
      
      if (results.length > 0) {
        // Sort by distance if available
        if (userLocation) {
          results.sort((a: SearchResult, b: SearchResult) => {
            if (!a.distance || !b.distance) return 0;
            const distanceA = parseFloat(a.distance.replace(/[^\d.]/g, ''));
            const distanceB = parseFloat(b.distance.replace(/[^\d.]/g, ''));
            return distanceA - distanceB;
          });
        }

        return NextResponse.json({ 
          results: results.slice(0, maxResults),
          query: query.trim(),
          totalResults: results.length,
          processedResults: Math.min(results.length, maxResults),
          source: 'geoapify'
        });
      }
      
      // Fallback to sample data
      const fallbackResults = getSampleLocalBusinesses(userLocation, query);
      
      return NextResponse.json({ 
        results: fallbackResults,
        query: query.trim(),
        totalResults: fallbackResults.length,
        processedResults: fallbackResults.length,
        source: 'fallback'
      });

    } catch (searchError) {
      console.error('Geoapify search error:', searchError);
      
      const fallbackResults = getSampleLocalBusinesses(userLocation, query);
      
      return NextResponse.json({ 
        results: fallbackResults,
        query: query.trim(),
        totalResults: fallbackResults.length,
        processedResults: fallbackResults.length,
        source: 'fallback',
        warning: 'Using sample data due to search service issues'
      });
    }

  } catch (error) {
    console.error('Search API error:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json({ 
        error: 'Invalid request format',
        message: 'Please check your request data'
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Please try again later'
    }, { status: 500 });
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests'
  }, { status: 405 });
}