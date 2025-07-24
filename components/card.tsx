"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// TypeScript interfaces matching backend
interface Author {
  name: string;
  role: string;
  href: string;
  imageUrl: string;
}

interface Category {
  title: string;
  href: string;
}

interface Post {
  id: string;
  title: string;
  href: string;
  description: string;
  date: string;
  datetime: string;
  category: Category;
  author: Author;
  imageUrl?: string;
  source?: string;
  originalUrl: string;
  content?: string;
  summary?: string;
  relevanceScore?: number;
  location?: string;
}

interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: string;
  author: string | null;
  section?: string;
  summary?: string;
  content?: string;
  relevanceScore?: number;
  location?: string;
}

interface ApiResponse {
  success: boolean;
  articles: NewsArticle[];
  totalResults: number;
  count: number;
  lastFetched?: string;
  error?: string;
  message?: string;
  debug?: {
    searchQuery?: string;
    searchStrategies?: string[];
    resultsPerStrategy?: number[];
    cityDetected?: string;
    locationContext?: string[];
    processingTime?: number;
    apiSource?: string;
    apiKeysPresent: {
      exa: boolean;
      openai: boolean;
      newsapi: boolean;
    };
  };
}

// Enhanced categories that work well with location-aware backend
const NEWS_CATEGORIES = [
  { id: 'all', label: 'All News', query: 'breaking news today latest' },
  { id: 'local', label: 'Local News', query: 'local city news today' },
  { id: 'world', label: 'World', query: 'world news international global today' },
  { id: 'politics', label: 'Politics', query: 'politics government election latest today' },
  { id: 'technology', label: 'Technology', query: 'technology tech innovation AI latest today' },
  { id: 'business', label: 'Business', query: 'business finance economy market latest today' },
  { id: 'science', label: 'Science', query: 'science research discovery latest today' },
  { id: 'health', label: 'Health', query: 'health medicine healthcare latest today' },
  { id: 'sports', label: 'Sports', query: 'sports game championship latest today' }
];

// Popular cities for quick search (matching backend location database)
const POPULAR_LOCATIONS = [
  { city: 'Mumbai', country: 'India', keywords: ['bollywood', 'financial capital'] },
  { city: 'Delhi', country: 'India', keywords: ['national capital', 'ncr'] },
  { city: 'Bangalore', country: 'India', keywords: ['silicon valley', 'garden city'] },
  { city: 'Chennai', country: 'India', keywords: ['madras', 'detroit of india'] },
  { city: 'Kolkata', country: 'India', keywords: ['calcutta', 'city of joy'] },
  { city: 'Pune', country: 'India', keywords: ['oxford of east', 'queen of deccan'] },
  { city: 'Hyderabad', country: 'India', keywords: ['cyberabad', 'pearl city'] },
  { city: 'London', country: 'UK', keywords: ['westminster', 'city of london'] },
  { city: 'New York', country: 'USA', keywords: ['nyc', 'big apple'] }
];

export default function EnhancedLocationAwareNewsComponent() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [isCustomSearch, setIsCustomSearch] = useState<boolean>(false);
  const [fetchCounter, setFetchCounter] = useState<number>(0);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<boolean>(false);
  
  const router = useRouter();

  // Function to create URL-friendly slug
  const createSlug = (title: string, index: number): string => {
    const timestamp = Date.now();
    return `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${index}-${timestamp}`;
  };

  // Function to get time ago string
  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const publishedDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return publishedDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Function to get source favicon
  const getSourceIcon = (source: string): string => {
    const domain = source.toLowerCase();
    return `https://www.google.com/s2/favicons?domain=${domain}.com&sz=32`;
  };

  // Function to store article data for detail page
  const storeArticleData = (article: Post): void => {
    if (typeof window !== 'undefined') {
      const articlesData = JSON.parse(localStorage.getItem('newsArticles') || '{}');
      articlesData[article.id] = article;
      localStorage.setItem('newsArticles', JSON.stringify(articlesData));
    }
  };

  // Handle article click - navigate to detail page
  const handleArticleClick = (post: Post): void => {
    storeArticleData(post);
    router.push(`/news/${post.id}`);
  };

  // Enhanced search query that leverages backend location detection
  const buildLocationAwareQuery = (searchTerm: string, categoryId: string = 'all'): string => {
    if (searchTerm && searchTerm.trim()) {
      const cleanTerm = searchTerm.trim();
      
      // Check if it contains location keywords - let backend handle detection
      const hasLocationKeywords = POPULAR_LOCATIONS.some(loc => 
        cleanTerm.toLowerCase().includes(loc.city.toLowerCase()) ||
        loc.keywords.some(keyword => cleanTerm.toLowerCase().includes(keyword.toLowerCase()))
      );

      if (hasLocationKeywords) {
        // Let backend location detection work its magic
        return cleanTerm;
      }

      // Enhanced context for specific search types
      if (cleanTerm.toLowerCase().includes('admission')) {
        return `${cleanTerm} university college application 2024 2025`;
      }
      if (cleanTerm.toLowerCase().includes('engineering')) {
        return `${cleanTerm} admission university college entrance exam`;
      }
      if (cleanTerm.toLowerCase().includes('exam')) {
        return `${cleanTerm} result notification date 2024 2025`;
      }
      if (cleanTerm.toLowerCase().includes('weather')) {
        return `${cleanTerm} today forecast temperature`;
      }
      
      return `${cleanTerm} latest news`;
    }
    
    // Category-based queries optimized for backend
    const category = NEWS_CATEGORIES.find(cat => cat.id === categoryId);
    if (categoryId === 'local') {
      return 'local news city today breaking'; // Let backend detect user's location
    }
    
    return category ? category.query : 'breaking news today';
  };

  // Quick location search
  const handleLocationSearch = (location: { city: string; country: string }): void => {
    const locationQuery = `${location.city} news today latest`;
    setCustomQuery(locationQuery);
    setIsCustomSearch(true);
    setActiveCategory('all');
    fetchNews(locationQuery, 'all', true);
  };

  // Function to fetch news with enhanced backend integration
  const fetchNews = async (searchQuery?: string, categoryId?: string, forceRefresh: boolean = false): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      setDetectedLocation(null);
      
      const currentCategory = categoryId || activeCategory;
      const finalSearchQuery = searchQuery || 
                              (isCustomSearch ? customQuery : '') ||
                              buildLocationAwareQuery('', currentCategory);

      const enhancedQuery = buildLocationAwareQuery(finalSearchQuery, currentCategory);
      
      const url = new URL('/api/news', window.location.origin);
      url.searchParams.append('limit', '15'); // Increased for better location filtering
      url.searchParams.append('query', enhancedQuery);
      
      if (currentCategory !== 'all') {
        url.searchParams.append('category', currentCategory);
      }
      
      // Add timestamp and fresh flag for backend
      url.searchParams.append('t', Date.now().toString());
      if (forceRefresh) {
        url.searchParams.append('fresh', 'true');
      }
      
      console.log('🔍 Sending location-aware query:', enhancedQuery);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      const data: ApiResponse = await response.json();
      
      if (data.success && data.articles) {
        // Store debug info for analysis
        setDebugInfo(data.debug);
        if (data.debug?.cityDetected) {
          setDetectedLocation(data.debug.cityDetected);
        }

        // Remove duplicates based on URL (more reliable than title)
        const uniqueArticles = data.articles.filter((article, index, self) => {
          return index === self.findIndex(a => a.url === article.url);
        });

        // Transform the API data to match your card structure
        const transformedPosts: Post[] = uniqueArticles.map((article, index) => {
          const slug = createSlug(article.title || 'untitled', index);
          return {
            id: slug,
            title: article.title || 'No title available',
            href: `/news/${slug}`,
            originalUrl: article.url,
            description: article.description || article.summary || 'No description available',
            date: getTimeAgo(article.publishedAt),
            datetime: article.publishedAt,
            category: { 
              title: article.section || currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1), 
              href: '#' 
            },
            author: {
              name: article.author || article.source || 'News Reporter',
              role: 'Journalist',
              href: '#',
              imageUrl: getSourceIcon(article.source),
            },
            imageUrl: article.urlToImage || undefined,
            source: article.source,
            content: article.content,
            summary: article.summary || article.description,
            relevanceScore: article.relevanceScore,
            location: article.location
          };
        });
        
        // Sort by relevance score if available (location-aware), then by date
        transformedPosts.sort((a, b) => {
          if (a.relevanceScore !== undefined && b.relevanceScore !== undefined) {
            const scoreDiff = b.relevanceScore - a.relevanceScore;
            if (Math.abs(scoreDiff) > 0.1) return scoreDiff; // Significant relevance difference
          }
          return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
        });
        
        setPosts(transformedPosts);
        setLastFetched(new Date().toISOString());
        setFetchCounter(prev => prev + 1);
        
        if (transformedPosts.length === 0) {
          setError(data.message || `No recent news found for "${finalSearchQuery}". Try different search terms.`);
        }
      } else {
        setError(data.error || data.message || 'Failed to fetch news');
        setDebugInfo(data.debug);
        if (data.count === 0) {
          setPosts([]);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Network error: Unable to fetch news - ${errorMessage}`);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle category change
  const handleCategoryChange = (categoryId: string): void => {
    setActiveCategory(categoryId);
    setIsCustomSearch(false);
    setCustomQuery('');
    setDetectedLocation(null);
    fetchNews(undefined, categoryId, true);
  };

  // Handle custom search
  const handleCustomSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    if (customQuery.trim()) {
      setIsCustomSearch(true);
      setActiveCategory('all');
      fetchNews(customQuery.trim(), 'all', true);
    }
  };

  // Enhanced refresh function
  const handleReload = (): void => {
    const searchTerm = isCustomSearch ? customQuery : undefined;
    const category = isCustomSearch ? 'all' : activeCategory;
    fetchNews(searchTerm, category, true);
  };

  // Fetch news on component mount
  useEffect(() => {
    fetchNews(undefined, undefined, true);
  }, []);

  // Auto-refresh every 10 minutes (longer interval to be respectful to API)
  useEffect(() => {
    const interval = setInterval(() => {
      const searchTerm = isCustomSearch ? customQuery : undefined;
      const category = isCustomSearch ? 'all' : activeCategory;
      fetchNews(searchTerm, category, false); // Don't force refresh on auto-refresh
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [isCustomSearch, activeCategory, customQuery]);

  if (loading && posts.length === 0) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-lg text-gray-600">
                Searching for location-aware news...
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Using advanced search strategies to find the most relevant content
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="text-center max-w-md">
              <div className="text-red-500 text-6xl mb-4">📰</div>
              <p className="text-red-600 mb-4 font-medium">Error: {error}</p>
              {debugInfo && (
                <div className="text-xs text-gray-500 mb-4 p-3 bg-gray-50 rounded">
                  <p>API Source: {debugInfo.apiSource}</p>
                  <p>Processing Time: {debugInfo.processingTime}ms</p>
                  <p>Search Query: "{debugInfo.searchQuery}"</p>
                </div>
              )}
              <button
                onClick={handleReload}
                className="rounded-md bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
            Location-Aware News
            <span className="ml-2 inline-flex items-center">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            </span>
          </h2>
          <p className="mt-2 text-lg/8 text-gray-600">
            Intelligent news discovery with advanced location detection and relevance scoring
          </p>
          
          {/* Enhanced status info */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {lastFetched && (
              <span className="text-gray-500">
                Last updated: {new Date(lastFetched).toLocaleString()}
              </span>
            )}
            {detectedLocation && (
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                📍 Detected: {detectedLocation}
              </span>
            )}
            {debugInfo && (
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs hover:bg-gray-200"
              >
                Debug Info ({debugInfo.processingTime}ms)
              </button>
            )}
          </div>

          {/* Debug information */}
          {showDebug && debugInfo && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-xs space-y-2">
              <div><strong>Search Strategies:</strong> {debugInfo.searchStrategies?.join(', ')}</div>
              <div><strong>Location Context:</strong> {debugInfo.locationContext?.join(', ')}</div>
              <div><strong>API Keys:</strong> EXA: {debugInfo.apiKeysPresent?.exa ? '✅' : '❌'}, OpenAI: {debugInfo.apiKeysPresent?.openai ? '✅' : '❌'}</div>
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-500">
              ⚠️ {error}
            </p>
          )}
        </div>

        {/* Enhanced Search Interface */}
        <div className="mt-8 space-y-6">
          {/* Custom Search */}
          <form onSubmit={handleCustomSearch} className="flex gap-2">
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Search by location or topic (e.g., 'Mumbai traffic', 'Delhi pollution', 'Bangalore startups')..."
              className="text-black flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !customQuery.trim()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              🔍 Search
            </button>
          </form>

          {/* Quick Location Searches */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Quick Location Search:</h3>
              <button
                onClick={() => setLocationSuggestions(!locationSuggestions)}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                {locationSuggestions ? 'Hide' : 'Show All'} Cities
              </button>
            </div>
            
            <div className={`grid gap-2 transition-all duration-300 ${
              locationSuggestions ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'
            }`}>
              {(locationSuggestions ? POPULAR_LOCATIONS : POPULAR_LOCATIONS.slice(0, 4)).map((location) => (
                <button
                  key={`${location.city}-${location.country}`}
                  onClick={() => handleLocationSearch(location)}
                  disabled={loading}
                  className=" text-black text-left px-3 py-2 text-sm bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 rounded-md transition-colors disabled:opacity-50"
                >
                  📍 {location.city}, {location.country}
                </button>
              ))}
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            {NEWS_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                disabled={loading}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === category.id && !isCustomSearch
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {category.label}
                {category.id === 'local' && ' 📍'}
              </button>
            ))}
          </div>

          {/* Current search indicator */}
          {(isCustomSearch || activeCategory !== 'all') && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Currently showing:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {isCustomSearch ? `"${customQuery}"` : NEWS_CATEGORIES.find(c => c.id === activeCategory)?.label}
              </span>
              {detectedLocation && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                  📍 {detectedLocation}
                </span>
              )}
              <button
                onClick={() => {
                  setIsCustomSearch(false);
                  setCustomQuery('');
                  setActiveCategory('all');
                  setDetectedLocation(null);
                  fetchNews(undefined, 'all', true);
                }}
                className="text-indigo-600 hover:text-indigo-700 underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        
        <div className="flex justify-center mt-6">
          <button
            onClick={handleReload}
            disabled={loading}
            className={`rounded-md px-4 py-2 text-white font-semibold focus:outline-focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Finding Relevant News...
              </span>
            ) : (
              '🔄 Refresh News'
            )}
          </button>
        </div>

        {/* Enhanced News Grid */}
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {posts.map((post) => (
            <article 
              key={post.id} 
              className="group cursor-pointer flex max-w-xl flex-col items-start justify-between hover:shadow-xl transition-all duration-300 p-6 rounded-xl border border-gray-100 hover:border-indigo-300 bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50"
              onClick={() => handleArticleClick(post)}
            >
              {/* Relevance Score Indicator */}
              {post.relevanceScore !== undefined && post.relevanceScore > 0.5 && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                  {Math.round(post.relevanceScore * 100)}% match
                </div>
              )}

              {/* News Image */}
              {post.imageUrl && (
                <div className="w-full mb-4 overflow-hidden rounded-lg relative">
                  <img 
                    src={post.imageUrl} 
                    alt={post.title || 'News image'}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {post.location && (
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                      📍 {post.location}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-x-4 text-xs w-full">
                <time dateTime={post.datetime} className="text-gray-500 font-medium">
                  {post.date}
                </time>
                <span className="relative z-10 rounded-full bg-indigo-50 px-3 py-1.5 font-medium text-indigo-600 border border-indigo-200">
                  {post.category.title}
                </span>
                {post.source && (
                  <span className="flex items-center gap-1 text-gray-500 ml-auto">
                    <img 
                      src={getSourceIcon(post.source)} 
                      alt={post.source}
                      className="w-4 h-4"
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <span className="text-xs font-medium">{post.source}</span>
                  </span>
                )}
              </div>
              
              <div className="group relative flex-1 w-full">
                <h3 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors duration-200 line-clamp-2">
                  {post.title}
                </h3>
                <p className="mt-5 text-sm text-gray-600 line-clamp-3 leading-relaxed">
                  {post.description}
                </p>
                
                {/* Enhanced read more with location info */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center text-indigo-600 group-hover:text-indigo-700 font-medium text-sm">
                    <span>Read More</span>
                    <svg className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  {post.location && !post.imageUrl && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      📍 {post.location}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="relative mt-6 flex items-center gap-x-4 w-full pt-4 border-t border-gray-100">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 font-semibold text-sm">
                    {post.author.name?.charAt(0) || 'N'}
                  </span>
                </div>
                <div className="text-sm flex-1">
                  <p className="font-semibold text-gray-900">
                    {post.author.name || 'News Reporter'}
                  </p>
                  <p className="text-gray-600">{post.author.role}</p>
                </div>
                {/* Relevance indicator for non-image cards */}
                {post.relevanceScore !== undefined && post.relevanceScore > 0.7 && !post.imageUrl && (
                  <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                    High Relevance
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Enhanced no results state */}
        {posts.length === 0 && !loading && (
          <div className="text-center mt-10 py-12">
            <div className="text-gray-400 text-6xl mb-4">
              {detectedLocation ? '📍' : '📰'}
            </div>
            <p className="text-gray-500 text-lg">
              {detectedLocation 
                ? `No recent news found for ${detectedLocation}`
                : 'No recent news articles found'
              }
            </p>
            <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
              {isCustomSearch 
                ? `Try searching for "${customQuery}" with different keywords, or explore news from other locations.`
                : 'Try a different search term, category, or specific location.'
              }
            </p>
            
            {/* Suggested locations when no results */}
            {!detectedLocation && (
              <div className="mt-6">
                <p className="text-sm text-gray-600 mb-3">Try searching for news from these popular locations:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {POPULAR_LOCATIONS.slice(0, 6).map((location) => (
                    <button
                      key={`${location.city}-${location.country}`}
                      onClick={() => handleLocationSearch(location)}
                      className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-200 transition-colors"
                    >
                      📍 {location.city}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enhanced results summary */}
        {posts.length > 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-4 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-full">
              <span>📊 {posts.length} articles found</span>
              {detectedLocation && (
                <span>📍 Location: {detectedLocation}</span>
              )}
              {posts.filter(p => (p.relevanceScore || 0) > 0.5).length > 0 && (
                <span className="text-green-600">
                  🎯 {posts.filter(p => (p.relevanceScore || 0) > 0.5).length} highly relevant
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}