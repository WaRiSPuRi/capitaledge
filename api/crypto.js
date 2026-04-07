module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cryptoSymbols = [
    { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin', ticker: 'BTC' },
    { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum', ticker: 'ETH' },
    { symbol: 'BINANCE:SOLUSDT', name: 'Solana', ticker: 'SOL' },
    { symbol: 'BINANCE:BNBUSDT', name: 'BNB', ticker: 'BNB' },
    { symbol: 'BINANCE:XRPUSDT', name: 'XRP', ticker: 'XRP' },
  ];
  const key = process.env.FINNHUB_API_KEY;

  try {
    const results = await Promise.all(
      cryptoSymbols.map(async (c) => {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${c.symbol}&token=${key}`);
        const d = await r.json();
        return { symbol: c.ticker, name: c.name, price: d.c, change: d.d, changePercent: d.dp, high: d.h, low: d.l };
      })
    );
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ crypto: results, timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch crypto', detail: err.message });
  }
}
