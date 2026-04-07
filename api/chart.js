// api/chart.js - Historical stock chart data from Finnhub
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol = 'AAPL', resolution = 'W' } = req.query;
  const key = process.env.FINNHUB_API_KEY;

  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not set' });

  const now = Math.floor(Date.now() / 1000);
  // Use 1 year back with weekly resolution to stay within free tier limits
  const from = now - 365 * 24 * 60 * 60;

  try {
    // Try weekly resolution first (more reliable on free tier)
    let url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol.toUpperCase()}&resolution=W&from=${from}&to=${now}&token=${key}`;
    let r = await fetch(url);
    let d = await r.json();

    // If no weekly data, try daily with shorter range
    if (!d || d.s === 'no_data' || !d.t || d.t.length === 0) {
      const from90 = now - 90 * 24 * 60 * 60;
      url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol.toUpperCase()}&resolution=D&from=${from90}&to=${now}&token=${key}`;
      r = await fetch(url);
      d = await r.json();
    }

    if (!d || d.s === 'no_data' || !d.t || d.t.length === 0) {
      return res.status(200).json({ candles: [], symbol, message: 'No data available' });
    }

    const candles = d.t.map((time, i) => ({
      time, open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i], volume: d.v[i]
    }));

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    return res.status(200).json({ candles, symbol });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch chart data', detail: err.message });
  }
}
