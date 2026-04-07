// api/crypto.js - Crypto prices via Twelve Data
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return res.status(500).json({ error: 'TWELVEDATA_API_KEY not set' });

  const cryptoPairs = [
    { symbol: 'BTC/USD', name: 'Bitcoin', ticker: 'BTC' },
    { symbol: 'ETH/USD', name: 'Ethereum', ticker: 'ETH' },
    { symbol: 'SOL/USD', name: 'Solana', ticker: 'SOL' },
    { symbol: 'BNB/USD', name: 'BNB', ticker: 'BNB' },
    { symbol: 'XRP/USD', name: 'XRP', ticker: 'XRP' },
  ];

  try {
    const symbols = cryptoPairs.map(c => c.symbol).join(',');
    const url = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${key}`;
    const r = await fetch(url);
    const d = await r.json();

    const results = cryptoPairs.map(c => {
      const q = d[c.symbol] || {};
      const price = parseFloat(q.close || q.price || 0);
      const changePercent = parseFloat(q.percent_change || 0);
      return {
        symbol: c.ticker,
        name: c.name,
        price,
        changePercent,
        high: parseFloat(q.high || 0),
        low: parseFloat(q.low || 0)
      };
    }).filter(c => c.price > 0);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ crypto: results, timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch crypto', detail: err.message });
  }
}
