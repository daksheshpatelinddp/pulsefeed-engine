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
        JSON.stringify({ success: false, message: "Query parameter 'q' is required" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const GNEWS_KEY = env.GNEWS_KEY || "2542a34ac06dc0b643417f7d2b22cb95";
    const NEWSDATA_KEY = env.NEWSDATA_KEY || "pub_12f08057cb084a4b85ec90ebb5139099"; 

    let rawArticles = [];

    await Promise.allSettled([
      
      // 1. GNews API
      (async () => {
        try {
          const res = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&country=in&apikey=${GNEWS_KEY}`);
          if (res.ok) {
            const data = await res.json();
            if (data.articles) {
              rawArticles.push(...data.articles.map(a => ({
                title: a.title,
                link: a.url,
                pubDate: a.publishedAt,
                source_name: a.source?.name || "GNews",
                source_icon: null,
                api_source: "GNews API"
              })));
            }
          }
        } catch (e) {}
      })(),

      // 2. NewsData.io API
      (async () => {
        try {
          const res = await fetch(`https://newsdata.io/api/1/latest?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(query)}&language=en&country=in`);
          if (res.ok) {
            const data = await res.json();
            if (data.results) {
              rawArticles.push(...data.results.map(a => ({
                title: a.title,
                link: a.link,
                pubDate: a.pubDate,
                source_name: a.source_name || "NewsData",
                source_icon: a.source_icon || null,
                api_source: "NewsData.io"
              })));
            }
          }
        } catch (e) {}
      })(),

      // 3. Google News RSS (Routed through Proxy to Bypass Cloudflare Block)
      (async () => {
        try {
          const gnewsRss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(gnewsRss)}`;
          const res = await fetch(proxyUrl);
          if (res.ok) {
            const xml = await res.text();
            const items = parseXmlItems(xml, "Google News RSS", "Google News");
            rawArticles.push(...items);
          }
        } catch (e) {}
      })(),

      // 4. Bing News RSS (With Clean Link Resolution)
      (async () => {
        try {
          const res = await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS`);
          if (res.ok) {
            const xml = await res.text();
            const items = parseXmlItems(xml, "Bing News RSS", "Bing News");
            rawArticles.push(...items);
          }
        } catch (e) {}
      })(),

      // 5. Yahoo Finance RSS
      (async () => {
        try {
          const res = await fetch(`https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(query)}`);
          if (res.ok) {
            const xml = await res.text();
            const items = parseXmlItems(xml, "Yahoo Finance RSS", "Yahoo Finance");
            rawArticles.push(...items);
          }
        } catch (e) {}
      })()

    ]);

    return new Response(
      JSON.stringify({
        success: rawArticles.length > 0,
        query,
        total_raw_count: rawArticles.length,
        articles: rawArticles
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

function parseXmlItems(xmlText, apiSource, defaultSource) {
  const items = [];
  const blocks = xmlText.split("<item>");
  
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("</item>")[0];
    const title = block.match(/<title>(.*?)<\/title>/s)?.[1] || "";
    let link = block.match(/<link>(.*?)<\/link>/s)?.[1] || "";
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1] || "";
    const sourceMatch = block.match(/<source[^>]*>(.*?)<\/source>/s)?.[1] || defaultSource;

    // Extract real destination URL from Bing's tracking links if present
    if (link.includes("url=")) {
      const actualUrlMatch = link.match(/url=([^&]+)/);
      if (actualUrlMatch) {
        link = decodeURIComponent(actualUrlMatch[1]);
      }
    }

    if (title) {
      items.push({
        title: cleanText(title),
        link: cleanText(link),
        pubDate: cleanText(pubDate),
        source_name: cleanText(sourceMatch),
        source_icon: null,
        api_source: apiSource
      });
    }
  }
  return items;
}

function cleanText(str) {
  return str
    .replace("<![CDATA[", "")
    .replace("]]>", "")
    .replace(/<[^>]*>/g, "")
    .trim();
}