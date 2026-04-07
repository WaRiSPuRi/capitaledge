// api/chart.js - Historical stock chart data from Finnhub
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol = 'AAPL', resolution = 'D' } = req.query;
  const key = process.env.FINNHUB_API_KEY;

  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not set' });

  const now = Math.floor(Date.now() / 1000);
  const from = now - 90 * 24 * 60 * 60; // 90 days

  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol.toUpperCase()}&resolution=${resolution}&from=${from}&to=${now}&token=${key}`;
    const r = await fetch(url);
    const d = await r.json();

    if (!d || d.s === 'no_data' || !d.t) {
      return res.status(200).json({ candles: [], symbol, message: 'No data available for this symbol' });
    }

    const candles = d.t.map((time, i) => ({
      time, open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i], volume: d.v[i]
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json({ candles, symbol, resolution });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch chart data', detail: err.message });
  }
}
