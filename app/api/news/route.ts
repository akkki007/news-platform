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
    exaResultsCount?: number;
    processedCount?: number;
    timestamp?: string;
    apiKeysPresent: {
      exa: boolean;
      openai: boolean;
    };
  };
}

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY!);

// Initialize ChatOpenAI for content processing
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  temperature: 0.3,
  maxTokens: 300,
  modelName: "gpt-3.5-turbo",
});

// Prompt template for article summarization
const summaryPrompt = PromptTemplate.fromTemplate(`
You are a news editor. Create a concise, engaging description (2-3 sentences) for this news article.
Focus on the main points and make it compelling for readers.

Article Title: {title}
Article Content: {content}

Description:
`);

// Create the chain
const summaryChain = summaryPrompt.pipe(llm).pipe(new StringOutputParser());

// Function to extract domain name for source
function extractSource(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').split('.')[0];
  } catch {
    return 'Unknown Source';
  }
}

// Function to search for news using Exa
async function searchNews(query: string, numResults: number = 30): Promise<ExaResult[]> {
  try {
    const response = await exa.searchAndContents(query, {
      type: "neural",
      useAutoprompt: true,
      numResults: Math.min(numResults, 30),
      text: true,
      highlights: {
        numSentences: 3,
        highlightsPerUrl: 2,
      },
      includeDomains: [
        "reuters.com",
        "bbc.com",
        "cnn.com",
        "apnews.com",
        "npr.org",
        "theguardian.com",
        "nytimes.com",
        "washingtonpost.com",
        "bloomberg.com",
        "techcrunch.com",
        "wired.com",
        "axios.com",
        "politico.com"
      ],
      startPublishedDate: new Date().toISOString().split('T')[0], 
      category: "news"
    });

    return response.results;

  } catch (error: unknown) {
    console.error('Exa search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Exa search failed: ${errorMessage}`);
  }
}

// Function to enhance article with web scraping
async function enhanceArticleContent(article: ExaResult): Promise<ProcessedArticle> {
  let enhancedDescription = '';
  let imageUrl: string | null = null;

  try {
    // Use Exa highlights as primary description source
    if (article.highlights && article.highlights.length > 0) {
      enhancedDescription = article.highlights.join(' ');
    } else if (article.text) {
      // Fallback to text content, truncated
      enhancedDescription = article.text.substring(0, 300) + '...';
    }

    // Try to scrape for better content and images if needed
    if (!enhancedDescription || enhancedDescription.length < 50) {
      try {
        const loader = new CheerioWebBaseLoader(article.url, {
          selector: "article, .article-content, .story-body, .entry-content, main",
        });
        
        const docs = await loader.load();
        
        if (docs && docs.length > 0) {
          const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
          });
          
          const splitDocs = await textSplitter.splitDocuments(docs);
          
          if (splitDocs.length > 0 && process.env.OPENAI_API_KEY) {
            // Generate AI summary using the chain
            try {
              const summary = await summaryChain.invoke({
                title: article.title || 'Untitled',
                content: splitDocs[0].pageContent.substring(0, 1500)
              });
              
              enhancedDescription = summary.trim();
            } catch (summaryError) {
              console.log('Summary generation failed:', summaryError);
              enhancedDescription = splitDocs[0].pageContent.substring(0, 200) + '...';
            }
          }
        }
      } catch (scrapingError: unknown) {
        const errorMessage = scrapingError instanceof Error ? scrapingError.message : 'Unknown scraping error';
        console.log(`Scraping failed for ${article.url}:`, errorMessage);
      }
    }

    // Try to find an image
    if (article.image) {
      imageUrl = article.image;
    }

  } catch (error: unknown) {
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
    summary: enhancedDescription
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('') || '20');
    const query = searchParams.get('query') || 'breaking news today';
    const category = searchParams.get('category') || '';

    // Check required API keys
    if (!process.env.EXA_API_KEY) {
      throw new Error('EXA_API_KEY environment variable is required');
    }

    // Build search query based on parameters
    let searchQuery = query;
    if (category) {
      searchQuery = `${category} ${query}`;
    }

    console.log(`Searching for: "${searchQuery}" with limit: ${limit}`);

    // Search for news articles using Exa
    const exaResults = await searchNews(searchQuery, limit * 2);

    if (!exaResults || exaResults.length === 0) {
      return Response.json({
        success: true,
        articles: [],
        totalResults: 0,
        count: 0,
        lastFetched: new Date().toISOString(),
        message: 'No articles found for the given query'
      } as NewsApiResponse);
    }

    // Process articles in parallel with rate limiting
    const processPromises = exaResults
      .slice(0, limit)
      .map(async (result, index) => {
        // Add delay to avoid overwhelming servers
        await new Promise(resolve => setTimeout(resolve, index * 100));
        return enhanceArticleContent(result);
      });

    const processedArticles = await Promise.allSettled(processPromises);
    
    // Filter successful results
    const successfulArticles = processedArticles
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<ProcessedArticle>).value)
      .filter(article => article.title && !article.title.includes('[Removed]') && article.title !== 'Untitled Article');

    // Sort by publication date (newest first)
    successfulArticles.sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return Response.json({
      success: true,
      articles: successfulArticles,
      totalResults: exaResults.length,
      count: successfulArticles.length,
      lastFetched: new Date().toISOString(),
      debug: {
        searchQuery,
        exaResultsCount: exaResults.length,
        processedCount: successfulArticles.length,
        apiKeysPresent: {
          exa: !!process.env.EXA_API_KEY,
          openai: !!process.env.OPENAI_API_KEY
        }
      }
    } as NewsApiResponse);

  } catch (error: unknown) {
    console.error('News API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return Response.json({
      success: false,
      error: 'Failed to fetch news',
      message: errorMessage,
      articles: [],
      totalResults: 0,
      count: 0,
      lastFetched: new Date().toISOString(),
      debug: {
        timestamp: new Date().toISOString(),
        apiKeysPresent: {
          exa: !!process.env.EXA_API_KEY,
          openai: !!process.env.OPENAI_API_KEY
        }
      }
    } as NewsApiResponse, { status: 500 });
  }
}