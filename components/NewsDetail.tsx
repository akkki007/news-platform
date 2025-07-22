"use client"

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeftIcon, ShareIcon } from '@heroicons/react/24/outline';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  originalUrl: string;
  datetime: string;
  date: string;
  category: {
    title: string;
    href: string;
  };
  author: {
    name: string;
    role: string;
    imageUrl: string;
  };
  imageUrl?: string;
  source?: string;
  content?: string;
  summary?: string;
}

interface NewsDetailResponse {
  success: boolean;
  article?: {
    title: string;
    content: string;
    url: string;
    publishedAt: string;
    author?: string;
    source: string;
    description?: string;
  };
  error?: string;
}

export default function NewsDetailPage() {
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();

  // Function to get source favicon
  const getSourceIcon = (source: string): string => {
    const domain = source.toLowerCase();
    return `https://www.google.com/s2/favicons?domain=${domain}.com&sz=32`;
  };

  // Function to format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function to fetch full article content from your API
  const fetchFullContent = async (originalUrl: string): Promise<void> => {
    try {
      const response = await fetch('/api/news/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: originalUrl })
      });

      const data: NewsDetailResponse = await response.json();
      
      if (data.success && data.article) {
        setFullContent(data.article.content || data.article.description || '');
      }
    } catch (error) {
      console.error('Error fetching full content:', error);
    }
  };

  // Load article data on component mount
  useEffect(() => {
    if (!params?.id) return;

    const loadArticle = (): void => {
      try {
        // Get article from localStorage
        const articlesData = JSON.parse(localStorage.getItem('newsArticles') || '{}');
        const articleData = articlesData[params.id as string];
        
        if (articleData) {
          setArticle(articleData);
          if (articleData.originalUrl) {
            fetchFullContent(articleData.originalUrl);
          }
        } else {
          setError('Article not found');
        }
      } catch (err) {
        setError('Failed to load article');
        console.error('Error loading article:', err);
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [params?.id]);

  // Handle share functionality
  const handleShare = async (): Promise<void> => {
    if (!article) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback to copying URL to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy link:', error);
      }
    }
  };

  // Handle back navigation
  const handleBack = (): void => {
    router.back();
  };

  // Function to format article content with basic styling
  const formatContent = (content: string): string => {
    // Basic formatting - split by paragraphs and clean up
    return content
      .split('\n\n')
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0)
      .join('\n\n');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="animate-pulse">
            <div className="flex items-center mb-8">
              <div className="w-8 h-8 bg-gray-300 rounded mr-4"></div>
              <div className="w-32 h-4 bg-gray-300 rounded"></div>
            </div>
            <div className="w-full h-64 bg-gray-300 rounded-lg mb-6"></div>
            <div className="w-3/4 h-8 bg-gray-300 rounded mb-4"></div>
            <div className="w-full h-4 bg-gray-300 rounded mb-2"></div>
            <div className="w-full h-4 bg-gray-300 rounded mb-2"></div>
            <div className="w-2/3 h-4 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl text-gray-400 mb-4">📰</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Article Not Found</h1>
          <p className="text-gray-600 mb-8">{error || 'The requested article could not be found.'}</p>
          <button
            onClick={handleBack}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5 mr-2" />
              Back to News
            </button>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleShare}
                className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ShareIcon className="w-5 h-5 mr-1" />
                Share
              </button>
              
              <a
                href={article.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                
                Original
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-6 py-12">
        {/* Article Header */}
        <header className="mb-8">
          {/* Category and Meta Info */}
          <div className="flex items-center flex-wrap gap-4 mb-6 text-sm text-gray-600">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
              {article.category.title}
            </span>
            
            <time dateTime={article.datetime} className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDate(article.datetime)}
            </time>
            
            {article.source && (
              <div className="flex items-center">
                <img 
                  src={getSourceIcon(article.source)} 
                  alt={article.source}
                  className="w-4 h-4 mr-2"
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <span className="font-medium">{article.source}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-6">
            {article.title}
          </h1>

          {/* Author */}
          <div className="flex items-center mb-8">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
              <span className="text-indigo-600 font-semibold text-lg">
                {article.author.name?.charAt(0) || 'N'}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{article.author.name}</p>
              <p className="text-gray-600 text-sm">{article.author.role}</p>
            </div>
          </div>
        </header>

        {/* Featured Image */}
        {article.imageUrl && (
          <div className="mb-8">
            <div className="w-full h-64 md:h-96 rounded-lg overflow-hidden">
              <img 
                src={article.imageUrl} 
                alt={article.title}
                className="w-full h-full object-cover"
                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                  const target = e.target as HTMLImageElement;
                  target.parentElement!.style.display = 'none';
                }}
              />
            </div>
          </div>
        )}

        {/* Article Lead/Description */}
        <div className="mb-8">
          <div className="text-xl text-gray-700 leading-relaxed font-light border-l-4 border-indigo-500 pl-6 bg-gray-50 p-6 rounded-r-lg">
            {article.description}
          </div>
        </div>

        {/* Article Summary (if available) */}
        {article.summary && article.summary !== article.description && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="text-gray-800 leading-relaxed">
                {article.summary.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-3 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Full Content */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Full Article</h2>
          
          {fullContent ? (
            <div className="prose max-w-none">
              <div className="text-gray-800 leading-relaxed text-lg">
                {formatContent(fullContent).split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-6 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ) : article.content ? (
            <div className="prose max-w-none">
              <div className="text-gray-800 leading-relaxed text-lg">
                {formatContent(article.content).split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-6 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-center">
                Full content not available. 
                <a 
                  href={article.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 font-medium ml-1"
                >
                  Read the original article →
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Article Footer */}
        <footer className="border-t border-gray-200 pt-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleShare}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ShareIcon className="w-4 h-4 mr-2" />
                Share Article
              </button>
              
              <a
                href={article.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                
                View Original
              </a>
            </div>
            
            <div className="text-sm text-gray-500">
              Published: {formatDate(article.datetime)}
            </div>
          </div>
        </footer>

        {/* Related Articles Placeholder */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">More News</h3>
          <button
            onClick={handleBack}
            className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <ChevronLeftIcon className="w-4 h-4 mr-1" />
            Back to all articles
          </button>
        </div>
      </article>
    </div>
  );
}