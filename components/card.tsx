"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// TypeScript interfaces
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
}

interface ApiResponse {
  success: boolean;
  articles: NewsArticle[];
  totalResults: number;
  count: number;
  lastFetched?: string;
  error?: string;
  message?: string;
}

const NEWS_CATEGORIES = [
  { id: 'all', label: 'All News', query: 'breaking news today' },
  { id: 'world', label: 'World', query: 'world news international' },
  { id: 'politics', label: 'Politics', query: 'politics government election' },
  { id: 'technology', label: 'Technology', query: 'technology tech innovation AI' },
  { id: 'business', label: 'Business', query: 'business finance economy market' },
  { id: 'science', label: 'Science', query: 'science research discovery' },
  { id: 'health', label: 'Health', query: 'health medicine healthcare' },
  { id: 'sports', label: 'Sports', query: 'sports game championship' }
];

export default function EnhancedNewsComponent() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [isCustomSearch, setIsCustomSearch] = useState<boolean>(false);
  
  const router = useRouter();

  // Function to create URL-friendly slug
  const createSlug = (title: string, index: number): string => {
    return `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${index}`;
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

  // Function to fetch news from API
  const fetchNews = async (searchQuery?: string, categoryId?: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const currentCategory = categoryId || activeCategory;
      const query = searchQuery || 
                   (isCustomSearch ? customQuery : '') ||
                   NEWS_CATEGORIES.find(cat => cat.id === currentCategory)?.query ||
                   'breaking news today';

      const url = new URL('/api/news', window.location.origin);
      url.searchParams.append('limit', '9');
      url.searchParams.append('query', query);
      if (currentCategory !== 'all') {
        url.searchParams.append('category', currentCategory);
      }
      
      const response = await fetch(url.toString());
      const data: ApiResponse = await response.json();
      
      if (data.success && data.articles) {
        // Transform the API data to match your card structure
        const transformedPosts: Post[] = data.articles.map((article, index) => {
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
            summary: article.summary || article.description
          };
        });
        
        setPosts(transformedPosts);
        setLastFetched(data.lastFetched || new Date().toISOString());
      } else {
        setError(data.error || data.message || 'Failed to fetch news');
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
    fetchNews(undefined, categoryId);
  };

  // Handle custom search
  const handleCustomSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    if (customQuery.trim()) {
      setIsCustomSearch(true);
      setActiveCategory('all');
      fetchNews(customQuery.trim());
    }
  };

  // Fetch news on component mount
  useEffect(() => {
    fetchNews();
  }, []);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isCustomSearch) {
        fetchNews();
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isCustomSearch, activeCategory, customQuery]);

  const handleReload = (): void => {
    fetchNews(isCustomSearch ? customQuery : undefined);
  };
  
  if (loading && posts.length === 0) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-lg text-gray-600">
                Searching the web for latest news...
              </p>
              <p className="mt-2 text-sm text-gray-500">
                This may take a few seconds, please wait...
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
            <div className="text-center">
              <p className="text-red-600 mb-4">Error: {error}</p>
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
            Latest News Articles
            <span className="ml-2 inline-flex items-center">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            </span>
          </h2>
          <p className="mt-2 text-lg/8 text-gray-600">
            Real-time news from across the web, enhanced with AI summaries
          </p>
          {lastFetched && (
            <p className="mt-2 text-sm text-gray-500">
              Last updated: {new Date(lastFetched).toLocaleString()} • Auto-refreshes every 10 minutes
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-500">
              ⚠️ {error}
            </p>
          )}
        </div>

        {/* Search and Categories */}
        <div className="mt-8 space-y-4">
          {/* Custom Search */}
          <form onSubmit={handleCustomSearch} className="flex gap-2">
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Search for specific news topics..."
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !customQuery.trim()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              🔍 Search
            </button>
          </form>

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
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex justify-center mt-6">
          <button
            onClick={handleReload}
            disabled={loading}
            className={`rounded-md px-4 py-2 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
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
                Refreshing...
              </span>
            ) : (
              '🔄 Refresh News'
            )}
          </button>
        </div>

        {/* News Grid */}
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {posts.map((post) => (
            <article 
              key={post.id} 
              className="group cursor-pointer flex max-w-xl flex-col items-start justify-between hover:shadow-xl transition-all duration-300 p-6 rounded-xl border border-gray-100 hover:border-indigo-300 bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50"
              onClick={() => handleArticleClick(post)}
            >
              {/* News Image */}
              {post.imageUrl && (
                <div className="w-full mb-4 overflow-hidden rounded-lg">
                  <img 
                    src={post.imageUrl} 
                    alt={post.title || 'News image'}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
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
                
                {/* Read More Button */}
                <div className="mt-4 flex items-center text-indigo-600 group-hover:text-indigo-700 font-medium text-sm">
                  <span>Read More</span>
                  <svg className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              
              <div className="relative mt-6 flex items-center gap-x-4 w-full pt-4 border-t border-gray-100">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 font-semibold text-sm">
                    {post.author.name?.charAt(0) || 'N'}
                  </span>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">
                    {post.author.name || 'News Reporter'}
                  </p>
                  <p className="text-gray-600">{post.author.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {posts.length === 0 && !loading && (
          <div className="text-center mt-10 py-12">
            <div className="text-gray-400 text-6xl mb-4">📰</div>
            <p className="text-gray-500 text-lg">No news articles found</p>
            <p className="text-gray-400 text-sm mt-2">Try a different search term or category.</p>
          </div>
        )}
      </div>
    </div>
  );
}