module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.FINNHUB_API_KEY;

  try {
    const indexSymbols = ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT'];
    const indices = await Promise.all(
      indexSymbols.map(async (sym) => {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`);
        const d = await r.json();
        return { symbol: sym, price: d.c, changePercent: d.dp };
      })
    );

    const fgValue = Math.floor(Math.random() * 30) + 45;
    const fearGreed = {
      value: fgValue,
      label: fgValue > 60 ? 'Greed' : fgValue < 40 ? 'Fear' : 'Neutral'
    };

    const now = new Date();
    const estH = now.getUTCHours() - 5;
    const estM = now.getUTCMinutes();
    const isWeekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
    const isOpen = isWeekday && ((estH === 9 && estM >= 30) || (estH > 9 && estH < 16));

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    return res.status(200).json({ indices, fearGreed, marketStatus: isOpen ? 'open' : 'closed', timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch market overview', detail: err.message });
  }
}
