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
      const googleRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
      
      const res = await fetch(googleRssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "Accept": "text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        }
      });

      if (res.ok) {
        const xmlText = await res.text();
        articles = parseGoogleNewsXml(xmlText);
      }
    } catch (e) {
      // Catch potential fetch errors
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

function parseGoogleNewsXml(xmlText) {
  const items = [];
  const blocks = xmlText.split("<item>");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("</item>")[0];

    const titleMatch = block.match(/<title>(.*?)<\/title>/s);
    const linkMatch = block.match(/<link>(.*?)<\/link>/s);
    const pubDateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/s);
    const sourceMatch = block.match(/<source[^>]*>(.*?)<\/source>/s);

    const title = titleMatch ? cleanText(titleMatch[1]) : "";
    const link = linkMatch ? cleanText(linkMatch[1]) : "";
    const pubDate = pubDateMatch ? cleanText(pubDateMatch[1]) : "";
    const source = sourceMatch ? cleanText(sourceMatch[1]) : "Google News";

    if (title && link) {
      items.push({
        title,
        link,
        pubDate,
        source_name: source,
        source_icon: null,
        api_source: "Google News RSS"
      });
    }
  }

  return items;
}

function cleanText(str) {
  if (!str) return "";
  return str
    .replace("<![CDATA[", "")
    .replace("]]>", "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}