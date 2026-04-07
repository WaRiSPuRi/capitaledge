// api/chart.js - Historical chart data via Twelve Data
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol = 'AAPL' } = req.query;
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return res.status(500).json({ error: 'TWELVEDATA_API_KEY not set' });

  try {
    // Get 90 days of daily data
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol.toUpperCase()}&interval=1day&outputsize=90&apikey=${key}`;
    const r = await fetch(url);
    const d = await r.json();

    if (d.status === 'error' || !d.values || d.values.length === 0) {
      return res.status(200).json({ candles: [], symbol, message: d.message || 'No data available' });
    }

    // Twelve Data returns newest first - reverse for chronological order
    const candles = d.values.reverse().map(v => ({
      time: Math.floor(new Date(v.datetime).getTime() / 1000),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseInt(v.volume || 0)
    }));

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    return res.status(200).json({ candles, symbol });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch chart', detail: err.message });
  }
}
