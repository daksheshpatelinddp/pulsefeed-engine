export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
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

    const GNEWS_KEY = env.GNEWS_KEY || "2542a34ac06dc0b643417f7d2b22cb95";
    let articles = [];
    let usedSource = "";

    // Primary Source: Direct GNews API Request
    try {
      const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&apikey=${GNEWS_KEY}`;
      const res = await fetch(gnewsUrl);
      
      if (res.ok) {
        const data = await res.json();
        if (data.articles && data.articles.length > 0) {
          articles = data.articles.map(a => ({
            title: a.title,
            link: a.url,
            pubDate: a.publishedAt
          }));
          usedSource = "GNews API";
        }
      }
    } catch (e) {
      // Fallback logging if needed
    }

    // Secondary Fallback: Yahoo Finance RSS for Stock Tickers
    if (articles.length === 0) {
      try {
        const yahooUrl = `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(query)}`;
        const res = await fetch(yahooUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        const xmlText = await res.text();
        const items = parseXmlItems(xmlText);
        if (items.length > 0) {
          articles = items;
          usedSource = "Yahoo Finance RSS";
        }
      } catch (e) {}
    }

    return new Response(
      JSON.stringify({
        success: articles.length > 0,
        query,
        source: usedSource,
        count: articles.length,
        articles
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
};

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