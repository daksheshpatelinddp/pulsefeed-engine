export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
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
        JSON.stringify({ success: false, message: "Query parameter 'q' is required" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*" 
          } 
        }
      );
    }

    let articles = [];

    try {
      // Build Google News RSS URL for India / English
      const googleRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
      
      // Fetch via rss2json API to bypass Cloudflare Worker IP blocks
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleRssUrl)}`);

      if (res.ok) {
        const data = await res.json();
        
        if (data.status === "ok" && data.items) {
          articles = data.items.map(item => ({
            title: cleanText(item.title),
            link: item.link,
            pubDate: item.pubDate,
            source_name: item.author || "Google News",
            source_icon: null,
            api_source: "Google News RSS"
          }));
        }
      }
    } catch (e) {
      // Error handling
    }

    return new Response(
      JSON.stringify({
        success: articles.length > 0,
        query,
        total_raw_count: articles.length,
        articles: articles
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

function cleanText(str) {
  if (!str) return "";
  return str
    .replace("<![CDATA[", "")
    .replace("]]>", "")
    .replace(/<[^>]*>/g, "")
    .trim();
}