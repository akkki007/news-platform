'use client'

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Clock, Phone, Globe, Navigation, Target, Loader2, ExternalLink, AlertCircle, Car } from 'lucide-react';

// Type definitions
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

interface SearchApiResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
  processedResults: number;
  error?: string;
  message?: string;
}

const LocationSearchEngine: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');

  // Get user's current location with higher accuracy
  const getCurrentLocation = (): void => {
    setIsGettingLocation(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Use a more detailed geocoding service
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          
          let address = '';
          let city = '';
          
          if (response.ok) {
            const data = await response.json();
            address = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            city = data.city || data.locality || data.principalSubdivision || 'Unknown';
          }

          const newLocation: UserLocation = {
            lat: latitude,
            lng: longitude,
            address: address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            city: city
          };

          setUserLocation(newLocation);
          setIsGettingLocation(false);
        } catch (error) {
          console.error('Error getting address:', error);
          setUserLocation({
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            city: 'Unknown'
          });
          setIsGettingLocation(false);
        }
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location access to find nearby places.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }
        setLocationError(errorMessage);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // 1 minute
      }
    );
  };

  // Updated search function to use the API route
  const handleSearch = async (): Promise<void> => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    setSearchError('');

    try {
      const requestBody = {
        query: searchQuery.trim(),
        userLocation: userLocation,
        searchDepth: 'advanced',
        maxResults: 8
      };

      console.log('Sending search request:', requestBody);
      
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data: SearchApiResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (data.error) {
        throw new Error(data.message || data.error);
      }

      console.log('Search API response:', data);
      
      setSearchResults(data.results || []);
      
      // Show additional info if available
      if (data.totalResults && data.processedResults) {
        console.log(`Found ${data.totalResults} results, showing ${data.processedResults} relevant businesses`);
      }
      
    } catch (error) {
      console.error('Search error:', error);
      
      let errorMessage = 'Search failed. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('408')) {
          errorMessage = 'Search request timed out. Please try again.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Search service temporarily unavailable. Please try again later.';
        } else if (error.message.includes('400')) {
          errorMessage = 'Invalid search query. Please try different keywords.';
        } else if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setSearchError(errorMessage);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Location-aware quick searches
  const getQuickSearches = () => {
    return [
      'restaurants near me',
      'gas stations',
      'pharmacies',
      'coffee shops',
      'grocery stores',
      'hospitals',
      'banks and ATMs',
      'auto repair shops'
    ];
  };

  const renderResultCard = (result: SearchResult, index: number): JSX.Element => {
    const openGoogleMaps = () => {
      if (result.address && userLocation) {
        const query = encodeURIComponent(result.address);
        const mapsUrl = `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${query}`;
        window.open(mapsUrl, '_blank');
      }
    };

    return (
      <div key={index} className="bg-white rounded-lg shadow-lg p-6 mb-4 hover:shadow-xl transition-all duration-300 border-l-4 border-blue-500">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">{result.title}</h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {result.category}
              </span>
              {result.priceLevel && (
                <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                  {result.priceLevel}
                </span>
              )}
            </div>
          </div>
          {result.rating && (
            <div className="flex items-center bg-yellow-50 px-3 py-2 rounded-lg ml-3">
              <Star className="w-4 h-4 text-yellow-500 mr-1 fill-current" />
              <span className="text-sm font-semibold">{result.rating}</span>
            </div>
          )}
        </div>
        
        <p className="text-gray-600 mb-4 text-sm leading-relaxed">{result.snippet}</p>
        
        <div className="space-y-3 mb-4">
          {result.address && (
            <div className="flex items-start text-gray-700">
              <MapPin className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1">
                <span className="text-sm">{result.address}</span>
                {result.distance && (
                  <div className="flex items-center mt-1">
                    <span className="text-blue-600 font-semibold text-sm mr-2">
                      📍 {result.distance} away
                    </span>
                  
                    <span className="text-xs text-gray-500">
                      ~{Math.round(parseFloat(result.distance) * 12)} min walk
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {result.phone && (
            <div className="flex items-center text-gray-700">
              <Phone className="w-5 h-5 mr-3 flex-shrink-0 text-green-500" />
              <a href={`tel:${result.phone}`} className="text-sm hover:text-blue-600 transition-colors font-medium">
                {result.phone}
              </a>
            </div>
          )}

          {result.openingHours && (
            <div className="flex items-center text-gray-700">
              <Clock className="w-5 h-5 mr-3 flex-shrink-0 text-purple-500" />
              <span className="text-sm">{result.openingHours}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          
          {userLocation && result.address && (
            <button 
              onClick={openGoogleMaps}
              className="flex items-center text-green-600 hover:text-green-700 transition-colors text-sm font-medium bg-green-50 px-3 py-2 rounded-lg"
            >
              <Navigation className="w-4 h-4 mr-1" />
              Get Directions
            </button>
          )}
        </div>
      </div>
    );
  };

  // Auto-get location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-3">
            🗺️ LocalFind GPS
          </h1>
          <p className="text-lg text-gray-600">Discover the closest places around you instantly</p>
        </div>

        {/* Location Section */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <Target className="w-5 h-5 mr-2 text-blue-500" />
                Your Location
              </h2>
              <button
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isGettingLocation ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Target className="w-4 h-4 mr-2" />
                )}
                {isGettingLocation ? 'Locating...' : 'Update Location'}
              </button>
            </div>
            
            {userLocation && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-start text-green-800">
                  <MapPin className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">
                      📍 {userLocation.city ? `${userLocation.city}` : 'Location Detected'}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      {userLocation.address}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {locationError && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center text-red-600">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <p className="text-sm">{locationError}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Section */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
              <Search className="w-5 h-5 mr-2 text-purple-500" />
              Find Places Near You
            </h2>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="restaurants, gas stations, pharmacies, coffee shops..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || isSearching}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center font-medium"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </button>
            </div>
            
            {/* Quick Search Suggestions */}
            <div className="mt-6">
              <p className="text-sm text-gray-600 mb-3">🔥 Popular searches:</p>
              <div className="flex flex-wrap gap-2">
                {getQuickSearches().map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setSearchQuery(suggestion)}
                    className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-full text-sm hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 transition-all duration-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Error */}
            {searchError && (
              <div className="mt-4 bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center text-red-600">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <p className="text-sm">{searchError}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800 flex items-center">
              <MapPin className="w-6 h-6 mr-2 text-red-500" />
              Found {searchResults.length} places near you
              {userLocation && (
                <span className="text-base text-blue-600 ml-3 bg-blue-50 px-3 py-1 rounded-full">
                  📍 Within {userLocation.city}
                </span>
              )}
            </h2>
            <div className="grid gap-6">
              {searchResults.map(renderResultCard)}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-xl shadow-lg p-12">
              <div className="flex items-center justify-center mb-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                🔍 Searching for places near you...
              </h3>
              <p className="text-gray-500">Finding the closest and most relevant results</p>
            </div>
          </div>
        )}

        {/* No Results */}
        {searchQuery && searchResults.length === 0 && !isSearching && searchError === '' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-xl shadow-lg p-12">
              <div className="text-gray-400 mb-4">
                <Search className="w-20 h-20 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No places found</h3>
              <p className="text-gray-500 mb-4">
                Try different keywords or make sure your location is enabled for better results.
              </p>
              <button
                onClick={() => setSearchQuery('restaurants')}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Try searching for restaurants
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationSearchEngine;