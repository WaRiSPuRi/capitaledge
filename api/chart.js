module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol = 'AAPL', resolution = 'D', from, to } = req.query;
  const key = process.env.FINNHUB_API_KEY;
  const now = Math.floor(Date.now() / 1000);
  const start = from || (now - 90 * 24 * 60 * 60);
  const end = to || now;

  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${start}&to=${end}&token=${key}`);
    const d = await r.json();
    if (d.s === 'no_data') return res.status(200).json({ candles: [], symbol });
    const candles = d.t.map((time, i) => ({ time, open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i], volume: d.v[i] }));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json({ candles, symbol, resolution });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch chart data', detail: err.message });
  }
}
