// api/news.js - Financial news via GNews API (works on production!)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.GNEWS_API_KEY;
  if (!key) return res.status(500).json({ error: 'GNEWS_API_KEY not set' });

  const { topic = 'investing' } = req.query;

  const queries = {
    investing: 'stock market investing',
    crypto: 'bitcoin cryptocurrency',
    macro: 'federal reserve economy inflation',
    earnings: 'earnings results revenue'
  };

  const q = encodeURIComponent(queries[topic] || queries.investing);

  try {
    const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&country=us&max=10&sortby=publishedAt&apikey=${key}`;
    const r = await fetch(url);
    const d = await r.json();

    if (!d.articles) throw new Error(d.errors ? d.errors.join(', ') : 'No articles returned');

    const articles = d.articles.map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name || 'Finance News',
      publishedAt: a.publishedAt,
      urlToImage: a.image
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json({ articles, topic, timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch news', detail: err.message });
  }
}
