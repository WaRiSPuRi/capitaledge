module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbols = ['SPY','QQQ','DIA','AAPL','NVDA','TSLA','META','AMZN','MSFT','GOOGL'];
  const key = process.env.FINNHUB_API_KEY;

  try {
    const results = await Promise.all(
      symbols.map(async (sym) => {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`);
        const d = await r.json();
        return { symbol: sym, price: d.c, change: d.d, changePercent: d.dp, high: d.h, low: d.l, open: d.o, prevClose: d.pc };
      })
    );
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ quotes: results, timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quotes', detail: err.message });
  }
}
