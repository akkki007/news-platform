// app/api/news/route.ts
import Exa from "exa-js";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

interface ExaResult {
  title: string | null;
  url: string;
  publishedDate: string;
  author?: string | null;
  score: number;
  id: string;
  text?: string | null;
  highlights?: string[] | null;
  highlightScores?: number[] | null;
  image?: string | null;
}

interface ProcessedArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: string;
  author: string | null;
  section: string;
  content?: string;
  summary?: string;
  relevanceScore?: number;
  location?: string;
}

interface NewsApiResponse {
  success: boolean;
  articles: ProcessedArticle[];
  totalResults: number;
  count: number;
  lastFetched: string;
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

// Enhanced city and location detection
interface LocationContext {
  city: string;
  state?: string;
  country: string;
  aliases: string[];
  localKeywords: string[];
  nearbyPlaces: string[];
  localSources: string[];
}

// Comprehensive location database
const LOCATION_DATABASE: { [key: string]: LocationContext } = {
  // Indian Cities
  'mumbai': {
    city: 'Mumbai',
    state: 'Maharashtra', 
    country: 'India',
    aliases: ['bombay', 'mumbai city', 'financial capital'],
    localKeywords: ['bollywood', 'bmc', 'local trains', 'marine drive', 'gateway of india', 'bandra', 'andheri', 'juhu', 'powai', 'worli'],
    nearbyPlaces: ['pune', 'nashik', 'thane', 'navi mumbai', 'kalyan'],
    localSources: ['mumbaimirror.indiatimes.com', 'mid-day.com', 'freepressjournal.in', 'mumbailive.com']
  },
  'delhi': {
    city: 'Delhi',
    state: 'Delhi',
    country: 'India', 
    aliases: ['new delhi', 'national capital', 'ncr'],
    localKeywords: ['connaught place', 'india gate', 'red fort', 'chandni chowk', 'delhi metro', 'gurgaon', 'noida', 'faridabad'],
    nearbyPlaces: ['gurgaon', 'noida', 'faridabad', 'ghaziabad'],
    localSources: ['delhiconfidential.com', 'newdelhitimes.com', 'delhiplanet.com']
  },
  'bangalore': {
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    aliases: ['bengaluru', 'silicon valley of india', 'garden city'],
    localKeywords: ['electronic city', 'whitefield', 'koramangala', 'indiranagar', 'mg road', 'brigade road', 'lalbagh'],
    nearbyPlaces: ['mysore', 'hosur', 'tumkur'],
    localSources: ['bangaloremirror.indiatimes.com', 'deccanherald.com', 'newindianexpress.com']
  },
  'chennai': {
    city: 'Chennai',
    state: 'Tamil Nadu', 
    country: 'India',
    aliases: ['madras', 'detroit of india'],
    localKeywords: ['marina beach', 't nagar', 'adyar', 'velachery', 'tambaram', 'chennai central'],
    nearbyPlaces: ['kanchipuram', 'vellore', 'tiruvannamalai'],
    localSources: ['thehindu.com', 'newindianexpress.com', 'deccanchronicle.com']
  },
  'kolkata': {
    city: 'Kolkata',
    state: 'West Bengal',
    country: 'India',
    aliases: ['calcutta', 'city of joy', 'cultural capital'],
    localKeywords: ['howrah bridge', 'park street', 'durga puja', 'eden gardens', 'college street'],
    nearbyPlaces: ['howrah', 'salt lake', 'barrackpore'],
    localSources: ['telegraphindia.com', 'anandabazar.com', 'ei-samay.com']
  },
  'pune': {
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    aliases: ['oxford of the east', 'queen of deccan'],
    localKeywords: ['koregaon park', 'hinjewadi', 'wakad', 'kothrud', 'aundh', 'pune university'],
    nearbyPlaces: ['mumbai', 'nashik', 'satara'],
    localSources: ['punemirror.indiatimes.com', 'punekarnews.in', 'loksatta.com']
  },
  'hyderabad': {
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    aliases: ['cyberabad', 'pearl city', 'nizams city'],
    localKeywords: ['hitec city', 'gachibowli', 'jubilee hills', 'banjara hills', 'charminar', 'golconda'],
    nearbyPlaces: ['secunderabad', 'warangal', 'nizamabad'],
    localSources: ['telanganatoday.com', 'thehansindia.com', 'siasat.com']
  },
  // International Cities  
  'london': {
    city: 'London',
    country: 'UK',
    aliases: ['greater london', 'city of london'],
    localKeywords: ['westminster', 'city of london', 'tower bridge', 'piccadilly', 'canary wharf', 'oxford street'],
    nearbyPlaces: ['birmingham', 'manchester', 'bristol'],
    localSources: ['standard.co.uk', 'mylondon.news', 'londonist.com']
  },
  'newyork': {
    city: 'New York',
    state: 'New York',
    country: 'USA',
    aliases: ['nyc', 'new york city', 'big apple', 'manhattan'],
    localKeywords: ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten island', 'wall street', 'times square'],
    nearbyPlaces: ['newark', 'jersey city', 'yonkers'],
    localSources: ['ny1.com', 'gothamist.com', 'amny.com']
  }
};

// Initialize clients
const exa = new Exa(process.env.EXA_API_KEY!);
const llm = process.env.OPENAI_API_KEY ? new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  temperature: 0.3,
  maxTokens: 400,
  modelName: "gpt-3.5-turbo",
}) : null;

// Enhanced prompt for location-aware summarization
const locationAwareSummaryPrompt = PromptTemplate.fromTemplate(`
You are a local news editor. Create a concise, engaging description (2-3 sentences) for this news article.
Focus on the local impact and relevance to {location}.

Article Title: {title}
Article Content: {content}
Location Context: {location}

Description (focus on local relevance):
`);

const summaryChain = llm ? locationAwareSummaryPrompt.pipe(llm).pipe(new StringOutputParser()) : null;

// Advanced location detection from query
function detectLocationFromQuery(query: string): LocationContext | null {
  const queryLower = query.toLowerCase();
  
  // Direct city name matching
  for (const [key, location] of Object.entries(LOCATION_DATABASE)) {
    if (queryLower.includes(key) || 
        queryLower.includes(location.city.toLowerCase()) ||
        location.aliases.some(alias => queryLower.includes(alias.toLowerCase()))) {
      return location;
    }
  }
  
  // Check for local keywords that might indicate a city
  for (const [key, location] of Object.entries(LOCATION_DATABASE)) {
    const matchingKeywords = location.localKeywords.filter(keyword => 
      queryLower.includes(keyword.toLowerCase())
    );
    if (matchingKeywords.length >= 2) { // Multiple local keywords suggest this city
      return location;
    }
  }
  
  return null;
}

// Build location-optimized search queries
function buildLocationAwareQueries(originalQuery: string, location: LocationContext | null): string[] {
  const queries: string[] = [];
  const baseTerms = originalQuery.toLowerCase().replace(/\b(news|latest|today|breaking)\b/g, '').trim();
  
  if (location) {
    // Primary query with exact city name
    queries.push(`${baseTerms} ${location.city} ${location.state || ''} news`);
    
    // Query with local keywords for better context
    if (location.localKeywords.length > 0) {
      const topKeywords = location.localKeywords.slice(0, 3).join(' ');
      queries.push(`${baseTerms} ${location.city} ${topKeywords}`);
    }
    
    // Query with nearby places for regional coverage
    if (location.nearbyPlaces.length > 0) {
      const nearbyPlaces = location.nearbyPlaces.slice(0, 2).join(' ');
      queries.push(`${baseTerms} ${location.city} ${nearbyPlaces} region`);
    }
    
    // Alias-based queries
    location.aliases.forEach(alias => {
      queries.push(`${baseTerms} ${alias} news`);
    });
  } else {
    // Fallback queries for non-location specific searches
    queries.push(`${baseTerms} latest news`);
    queries.push(`${baseTerms} breaking news today`);
  }
  
  return queries.slice(0, 4); // Limit to prevent too many API calls
}

// Enhanced relevance scoring for location-based articles
function calculateLocationRelevance(article: ExaResult, location: LocationContext | null): number {
  if (!location) return 0.5; // Neutral score for non-location searches
  
  const titleText = (article.title || '').toLowerCase();
  const contentText = (article.text || '').toLowerCase();
  const urlText = article.url.toLowerCase();
  const combinedText = `${titleText} ${contentText} ${urlText}`;
  
  let score = 0;
  
  // Direct city name mentions (highest weight)
  if (combinedText.includes(location.city.toLowerCase())) score += 3;
  
  // State/region mentions
  if (location.state && combinedText.includes(location.state.toLowerCase())) score += 2;
  
  // Alias mentions
  location.aliases.forEach(alias => {
    if (combinedText.includes(alias.toLowerCase())) score += 2;
  });
  
  // Local keyword mentions
  const keywordMatches = location.localKeywords.filter(keyword => 
    combinedText.includes(keyword.toLowerCase())
  ).length;
  score += keywordMatches * 0.5;
  
  // Nearby places mentions
  const nearbyMatches = location.nearbyPlaces.filter(place => 
    combinedText.includes(place.toLowerCase())
  ).length;
  score += nearbyMatches * 0.3;
  
  // Local source bonus
  if (location.localSources.some(source => article.url.includes(source))) {
    score += 2;
  }
  
  // Normalize score to 0-1 range
  return Math.min(score / 10, 1);
}

// Multi-strategy location-aware search
async function searchWithLocationStrategy(queries: string[], location: LocationContext | null, numResults: number): Promise<ExaResult[]> {
  const allResults: ExaResult[] = [];
  const searchPromises: Promise<any>[] = [];
  
  for (const [index, query] of queries.entries()) {
    console.log(`🔍 Strategy ${index + 1}: "${query}"`);
    
    // Determine domains based on location
    let includeDomains: string[] = [];
    if (location) {
      if (location.country === 'India') {
        includeDomains = [
          "timesofindia.indiatimes.com", "indianexpress.com", "thehindu.com",
          "hindustantimes.com", "ndtv.com", "news18.com", "indiatoday.in",
          "livemint.com", "business-standard.com", "economictimes.indiatimes.com",
          ...location.localSources
        ];
      } else if (location.country === 'USA') {
        includeDomains = [
          "reuters.com", "apnews.com", "cnn.com", "npr.org", "axios.com",
          "washingtonpost.com", "nytimes.com"
        ];
      } else if (location.country === 'UK') {
        includeDomains = [
          "bbc.com", "theguardian.com", "reuters.com", "sky.com", "independent.co.uk"
        ];
      }
    }
    
    const searchPromise = exa.searchAndContents(query, {
      type: "neural",
      useAutoprompt: true,
      numResults: Math.ceil(numResults / queries.length) + 5, // Get extra for filtering
      text: true,
      highlights: {
        numSentences: 3,
        highlightsPerUrl: 2,
      },
      includeDomains: includeDomains.length > 0 ? includeDomains : undefined,
      startPublishedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
      category: "news"
    }).catch(error => {
      console.error(`Strategy ${index + 1} failed:`, error.message);
      return { results: [] };
    });
    
    searchPromises.push(searchPromise);
  }
  
  // Execute all searches in parallel
  const results = await Promise.allSettled(searchPromises);
  
  // Combine and score results
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.results) {
      const strategyResults = result.value.results.map((article: ExaResult) => ({
        ...article,
        relevanceScore: calculateLocationRelevance(article, location),
        searchStrategy: index
      }));
      allResults.push(...strategyResults);
    }
  });
  
  // Remove duplicates and sort by relevance
  const uniqueResults = allResults.filter((article, index, self) => 
    index === self.findIndex(a => a.url === article.url)
  );
  
  // Sort by relevance score and recency
  uniqueResults.sort((a, b) => {
    const scoreA = (a as any).relevanceScore || 0;
    const scoreB = (b as any).relevanceScore || 0;
    const dateA = new Date(a.publishedDate).getTime();
    const dateB = new Date(b.publishedDate).getTime();
    
    // Combine relevance and recency (70% relevance, 30% recency)
    const combinedA = scoreA * 0.7 + (dateA / Date.now()) * 0.3;
    const combinedB = scoreB * 0.7 + (dateB / Date.now()) * 0.3;
    
    return combinedB - combinedA;
  });
  
  console.log(`📊 Location Strategy Results: ${uniqueResults.length} unique articles`);
  if (location) {
    const highRelevance = uniqueResults.filter(a => (a as any).relevanceScore > 0.5).length;
    console.log(`🎯 High relevance articles for ${location.city}: ${highRelevance}/${uniqueResults.length}`);
  }
  
  return uniqueResults.slice(0, numResults);
}

// Enhanced article processing with location context
async function enhanceArticleWithLocation(article: ExaResult, location: LocationContext | null): Promise<ProcessedArticle> {
  let enhancedDescription = '';
  let imageUrl: string | null = null;
  
  try {
    // Use highlights first
    if (article.highlights && article.highlights.length > 0) {
      enhancedDescription = article.highlights.join(' ');
    } else if (article.text) {
      enhancedDescription = article.text.substring(0, 300) + '...';
    }
    
    // Try to find an image
    if (article.image) {
      imageUrl = article.image;
    }
    
    // Enhanced content extraction with location context
    if ((!enhancedDescription || enhancedDescription.length < 100) && article.url) {
      try {
        const loader = new CheerioWebBaseLoader(article.url, {
          selector: "article, .article-content, .story-body, .entry-content, main, .post-content",
          timeout: 8000
        });
        
        const docs = await loader.load();
        
        if (docs && docs.length > 0 && docs[0].pageContent) {
          const content = docs[0].pageContent.substring(0, 1200);
          
          if (summaryChain && content.length > 100 && location) {
            try {
              const summary = await summaryChain.invoke({
                title: article.title || 'Untitled',
                content: content,
                location: `${location.city}, ${location.state || location.country}`
              });
              
              enhancedDescription = summary.trim();
            } catch (summaryError) {
              console.log('Location-aware summary failed, using fallback');
              enhancedDescription = content.substring(0, 280) + '...';
            }
          } else {
            enhancedDescription = content.substring(0, 280) + '...';
          }
        }
      } catch (scrapingError) {
        console.log(`Content extraction failed for ${article.url}`);
      }
    }
    
  } catch (error) {
    console.error(`Error enhancing article ${article.url}:`, error);
    enhancedDescription = article.text?.substring(0, 200) + '...' || 'Click to read more...';
  }
  
  return {
    title: article.title || 'Untitled Article',
    description: enhancedDescription || 'Click to read more...',
    url: article.url,
    urlToImage: imageUrl,
    publishedAt: article.publishedDate,
    source: extractSource(article.url),
    author: article.author || null,
    section: 'News',
    summary: enhancedDescription,
    relevanceScore: (article as any).relevanceScore || 0,
    location: location ? `${location.city}, ${location.state || location.country}` : undefined
  };
}

function extractSource(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').split('.')[0];
  } catch {
    return 'Unknown Source';
  }
}

export async function GET(request: Request): Promise<Response> {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12');
    const query = searchParams.get('query') || 'breaking news today';
    const category = searchParams.get('category') || '';
    const forceRefresh = searchParams.get('fresh') === 'true';
    
    console.log(`\n🚀 Enhanced Location-Aware News API Request:`);
    console.log(`Query: "${query}" | Category: "${category}" | Limit: ${limit} | Fresh: ${forceRefresh}`);
    
    // Detect location from query
    const detectedLocation = detectLocationFromQuery(query);
    console.log(`📍 Location Detection: ${detectedLocation ? `${detectedLocation.city}, ${detectedLocation.country}` : 'Global'}`);
    
    let articles: ProcessedArticle[] = [];
    let searchStrategies: string[] = [];
    let resultsPerStrategy: number[] = [];
    
    if (!process.env.EXA_API_KEY) {
      return Response.json({
        success: false,
        error: 'EXA_API_KEY not configured',
        articles: [],
        totalResults: 0,
        count: 0,
        lastFetched: new Date().toISOString()
      } as NewsApiResponse, { status: 500 });
    }
    
    try {
      // Build location-aware search queries
      const searchQueries = buildLocationAwareQueries(query, detectedLocation);
      searchStrategies = searchQueries;
      console.log(`🔍 Search Strategies (${searchQueries.length}):`);
      searchQueries.forEach((q, i) => console.log(`  ${i + 1}. "${q}"`));
      
      // Execute location-aware search
      const exaResults = await searchWithLocationStrategy(searchQueries, detectedLocation, limit * 2);
      
      if (exaResults && exaResults.length > 0) {
        // Process articles with location context
        const processPromises = exaResults
          .slice(0, limit)
          .map(async (result, index) => {
            await new Promise(resolve => setTimeout(resolve, index * 100)); // Rate limiting
            return enhanceArticleWithLocation(result, detectedLocation);
          });
        
        const processedResults = await Promise.allSettled(processPromises);
        
        articles = processedResults
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<ProcessedArticle>).value)
          .filter(article => 
            article.title && 
            !article.title.includes('[Removed]') &&
            article.description.length > 20
          );
        
        resultsPerStrategy = [articles.length];
        
        console.log(`✅ Enhanced Search Success: ${articles.length} articles processed`);
        
        if (detectedLocation) {
          const highRelevanceCount = articles.filter(a => (a.relevanceScore || 0) > 0.5).length;
          console.log(`🎯 High relevance for ${detectedLocation.city}: ${highRelevanceCount}/${articles.length}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Enhanced search failed:', error);
      throw error;
    }
    
    // Final sorting - prioritize relevance for location searches
    if (detectedLocation && articles.length > 0) {
      articles.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        const dateA = new Date(a.publishedAt).getTime();
        const dateB = new Date(b.publishedAt).getTime();
        
        // For location searches, prioritize relevance more heavily
        const combinedA = scoreA * 0.8 + (dateA / Date.now()) * 0.2;
        const combinedB = scoreB * 0.8 + (dateB / Date.now()) * 0.2;
        
        return combinedB - combinedA;
      });
    } else {
      // For non-location searches, prioritize recency
      articles.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`\n⏱️ Total processing time: ${processingTime}ms`);
    console.log(`📊 Final result: ${articles.length} articles`);
    
    if (articles.length === 0) {
      return Response.json({
        success: false,
        articles: [],
        totalResults: 0,
        count: 0,
        lastFetched: new Date().toISOString(),
        message: detectedLocation 
          ? `No recent news found for ${detectedLocation.city}. Try broader search terms.`
          : 'No articles found. Try different search terms.',
        debug: {
          searchQuery: query,
          searchStrategies,
          cityDetected: detectedLocation?.city,
          locationContext: detectedLocation?.localKeywords.slice(0, 5),
          processingTime,
          apiSource: 'Enhanced-Location-Search',
          apiKeysPresent: {
            exa: !!process.env.EXA_API_KEY,
            openai: !!process.env.OPENAI_API_KEY,
            newsapi: !!process.env.NEWS_API_KEY
          }
        }
      } as NewsApiResponse, { status: 404 });
    }
    
    return Response.json({
      success: true,
      articles: articles,
      totalResults: articles.length,
      count: articles.length,
      lastFetched: new Date().toISOString(),
      debug: {
        searchQuery: query,
        searchStrategies,
        resultsPerStrategy,
        cityDetected: detectedLocation?.city,
        locationContext: detectedLocation?.localKeywords.slice(0, 5),
        processingTime,
        apiSource: 'Enhanced-Location-Search',
        apiKeysPresent: {
          exa: !!process.env.EXA_API_KEY,
          openai: !!process.env.OPENAI_API_KEY,
          newsapi: !!process.env.NEWS_API_KEY
        }
      }
    } as NewsApiResponse);
    
  } catch (error: unknown) {
    console.error('💥 Enhanced News API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return Response.json({
      success: false,
      error: 'Failed to fetch location-specific news',
      message: errorMessage,
      articles: [],
      totalResults: 0,
      count: 0,
      lastFetched: new Date().toISOString(),
      debug: {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - Date.now(),
        apiKeysPresent: {
          exa: !!process.env.EXA_API_KEY,
          openai: !!process.env.OPENAI_API_KEY,
          newsapi: !!process.env.NEWS_API_KEY
        }
      }
    } as NewsApiResponse, { status: 500 });
  }
}