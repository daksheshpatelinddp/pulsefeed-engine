export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, message: "Query parameter 'q' is required (e.g. ?q=Infosys)" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Your active GNews API key
    const GNEWS_KEY = env.GNEWS_KEY || "2542a34ac06dc0b643417f7d2b22cb95";

    let articles = [];
    let usedSource = "";

    // Step 1: Try Google News RSS
    try {
      articles = await fetchGoogleNews(query);
      if (articles.length > 0) usedSource = "Google News RSS";
    } catch (e) {}

    // Step 2: Fallback to Bing News RSS if Google News yields 0 results
    if (articles.length === 0) {
      try {
        articles = await fetchBingNews(query);
        if (articles.length > 0) usedSource = "Bing News RSS";
      } catch (e) {}
    }

    // Step 3: Fallback to GNews API if RSS feeds fail or return empty
    if (articles.length === 0 && GNEWS_KEY) {
      try {
        const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&apikey=${GNEWS_KEY}`;
        const res = await fetch(gnewsUrl);
        const data = await res.json();
        
        if (data.articles && data.articles.length > 0) {
          articles = data.articles.map(a => ({
            title: a.title,
            link: a.url,
            pubDate: a.publishedAt
          }));
          usedSource = "GNews API";
        }
      } catch (e) {}
    }

    return new Response(
      JSON.stringify({ success: true, query, source: usedSource, count: articles.length, articles }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
};

async function fetchGoogleNews(query) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(rssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  const xml = await res.text();
  return parseXmlItems(xml);
}

async function fetchBingNews(query) {
  const rssUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
  const res = await fetch(rssUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });
  const xml = await res.text();
  return parseXmlItems(xml);
}

function parseXmlItems(xmlText) {
  const items = [];
  const blocks = xmlText.split("<item>");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("</item>")[0];
    const title = block.match(/<title>(.*?)<\/title>/s)?.[1] || "";
    const link = block.match(/<link>(.*?)<\/link>/s)?.[1] || "";
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1] || "";
    if (title) {
      items.push({
        title: title.replace("<![CDATA[", "").replace("]]>", "").replace(/<[^>]*>/g, "").trim(),
        link: link.replace("<![CDATA[", "").replace("]]>", "").trim(),
        pubDate: pubDate.trim()
      });
    }
  }
  return items;
}