// api/market-overview.js - Market status + indices via Twelve Data
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return res.status(500).json({ error: 'TWELVEDATA_API_KEY not set' });

  try {
    const url = `https://api.twelvedata.com/quote?symbol=SPY,QQQ,IWM,GLD,TLT&apikey=${key}`;
    const r = await fetch(url);
    const d = await r.json();

    const indexSymbols = ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT'];
    const indices = indexSymbols.map(sym => {
      const q = d[sym] || {};
      return {
        symbol: sym,
        price: parseFloat(q.close || q.price || 0),
        changePercent: parseFloat(q.percent_change || 0)
      };
    }).filter(i => i.price > 0);

    // Fear & Greed based on SPY
    const spy = indices.find(i => i.symbol === 'SPY');
    let fgValue = 50;
    if (spy) {
      fgValue = Math.min(100, Math.max(0, Math.round(50 + (spy.changePercent * 8))));
    }
    const fearGreed = {
      value: fgValue,
      label: fgValue >= 75 ? 'Extreme Greed' : fgValue >= 55 ? 'Greed' : fgValue >= 45 ? 'Neutral' : fgValue >= 25 ? 'Fear' : 'Extreme Fear'
    };

    // Market hours (US Eastern)
    const now = new Date();
    const estH = now.getUTCHours() - 4;
    const estM = now.getUTCMinutes();
    const isWeekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
    const isOpen = isWeekday && ((estH === 9 && estM >= 30) || (estH > 9 && estH < 16));

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    return res.status(200).json({ indices, fearGreed, marketStatus: isOpen ? 'open' : 'closed', timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch overview', detail: err.message });
  }
}
