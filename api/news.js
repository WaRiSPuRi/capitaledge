module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.NEWS_API_KEY;
  const { topic = 'investing' } = req.query;

  const queries = {
    investing: 'stock market investing finance',
    crypto: 'bitcoin cryptocurrency crypto',
    macro: 'federal reserve inflation economy',
    earnings: 'earnings report quarterly results'
  };

  const q = encodeURIComponent(queries[topic] || queries.investing);

  try {
    const r = await fetch(`https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=12&apiKey=${key}`);
    const d = await r.json();
    if (d.status !== 'ok') throw new Error(d.message || 'NewsAPI error');
    const articles = d.articles.map(a => ({
      title: a.title, description: a.description, url: a.url,
      source: a.source?.name, publishedAt: a.publishedAt, urlToImage: a.urlToImage
    }));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json({ articles, topic, timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch news', detail: err.message });
  }
}
