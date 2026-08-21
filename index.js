async function fetchCombinedArticles(query) {
  const encodedQuery = encodeURIComponent(query);
  let allArticles = [];

  // 1. Direct fetch from your Cloudflare Worker engine (Handles Google, Bing, Yahoo & APIs)
  try {
    const workerUrl = `https://pulsefeed-engine.daksheshpatelin.workers.dev/?q=${encodedQuery}`;
    const res = await fetch(workerUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.articles) {
        const workerArticles = data.articles.map(item => ({
          title: item.title || '',
          link: item.link || '',
          description: item.description || '',
          pubDate: item.pubDate || '',
          source: `${item.source_name || 'News'} (${item.api_source || 'Worker Engine'})`
        }));
        allArticles.push(...workerArticles);
      }
    }
  } catch (e) {
    console.warn("Cloudflare Worker Feed Engine error:", e);
  }

  // 2. Client-side fallback to NewsData.io if configured in UI
  if (newsDataApiKey) {
    try {
      const res = await fetch(`https://newsdata.io/api/1/news?apikey=${newsDataApiKey}&q=${encodedQuery}&country=in&language=en`);
      const data = await res.json();
      if (data.status === 'success' && data.results) {
        const newsDataItems = data.results.map(item => ({
          title: item.title || '',
          link: item.link || '',
          description: item.description || item.content || '',
          pubDate: item.pubDate || '',
          source: `NewsData Direct (${item.source_id || 'Media'})`
        }));
        allArticles.push(...newsDataItems);
      }
    } catch (e) {
      console.warn("NewsData Direct API error:", e);
    }
  }

  return allArticles;
}