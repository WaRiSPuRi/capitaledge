// api/quotes.js - Live stock quotes via Twelve Data
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return res.status(500).json({ error: 'TWELVEDATA_API_KEY not set' });

  const symbols = ['SPY','QQQ','DIA','AAPL','NVDA','TSLA','META','AMZN','MSFT','GOOGL'];

  try {
    // Twelve Data supports batch requests - get all symbols in one call
    const url = `https://api.twelvedata.com/quote?symbol=${symbols.join(',')}&apikey=${key}`;
    const r = await fetch(url);
    const d = await r.json();

    // Handle both single and batch responses
    const quotes = symbols.map(sym => {
      const q = symbols.length === 1 ? d : (d[sym] || {});
      const price = parseFloat(q.close || q.price || 0);
      const prevClose = parseFloat(q.previous_close || 0);
      const change = price - prevClose;
      const changePercent = prevClose > 0 ? ((change / prevClose) * 100) : parseFloat(q.percent_change || 0);
      return {
        symbol: sym,
        price: parseFloat(q.close || q.price || 0),
        change: parseFloat(q.change || change || 0),
        changePercent: parseFloat(q.percent_change || changePercent || 0),
        high: parseFloat(q.high || 0),
        low: parseFloat(q.low || 0),
        open: parseFloat(q.open || 0),
        prevClose: parseFloat(q.previous_close || 0),
        volume: parseInt(q.volume || 0)
      };
    }).filter(q => q.price > 0);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ quotes, timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quotes', detail: err.message });
  }
}
