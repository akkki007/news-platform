import NewsDetailPage from "@/components/NewsDetail";

export default function NewsArticlePage() {
  return <NewsDetailPage />;
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  // You can fetch article data here for SEO
  return {
    title: 'News Article',
    description: 'Read the full news article',
  };
}