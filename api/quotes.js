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
    // Twelve Data batch endpoint - fetch all at once
    const url = `https://api.twelvedata.com/price?symbol=${symbols.join(',')}&apikey=${key}`;
    const r = await fetch(url);
    const priceData = await r.json();

    // Also get % change via quote endpoint for a few key symbols
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=SPY,QQQ,AAPL,NVDA,TSLA&apikey=${key}`;
    const quoteR = await fetch(quoteUrl);
    const quoteData = await quoteR.json();

    const quotes = symbols.map(sym => {
      // Get price from price endpoint
      const priceEntry = priceData[sym] || {};
      const price = parseFloat(priceEntry.price || 0);

      // Get change% from quote endpoint if available
      const quoteEntry = quoteData[sym] || {};
      const changePercent = parseFloat(quoteEntry.percent_change || 0);
      const prevClose = parseFloat(quoteEntry.previous_close || 0);
      const change = parseFloat(quoteEntry.change || 0);
      const high = parseFloat(quoteEntry.high || 0);
      const low = parseFloat(quoteEntry.low || 0);

      return { symbol: sym, price, changePercent, change, prevClose, high, low };
    }).filter(q => q.price > 0);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ quotes, timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quotes', detail: err.message });
  }
}
