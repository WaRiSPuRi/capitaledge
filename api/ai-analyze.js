// api/ai-analyze.js - AI Stock Analysis with Buy/Hold/Sell recommendation
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker, mode = 'analyze', question } = req.body;
  if (!ticker && mode !== 'chat') return res.status(400).json({ error: 'Ticker required' });

  const groqKey = process.env.GROQ_API_KEY;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const newsKey = process.env.NEWS_API_KEY;

  if (mode === 'chat') {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama3-70b-8192', max_tokens: 600, temperature: 0.7,
          messages: [
            { role: 'system', content: 'You are CapitalEdge AI, a helpful financial education assistant. Always end with: "⚠️ Disclaimer: This is for educational purposes only and is NOT financial advice. Always do your own research before investing."' },
            { role: 'user', content: question }
          ]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return res.status(200).json({ result: data.choices?.[0]?.message?.content || '', ticker: 'Q&A', mode });
    } catch (err) {
      return res.status(500).json({ error: 'AI failed', detail: err.message });
    }
  }

  let quoteData = null, chartData = null, newsData = null;
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 24 * 60 * 60;
    const [quoteRes, chartRes, newsRes] = await Promise.allSettled([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${now}&token=${finnhubKey}`),
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(ticker)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${newsKey}`)
    ]);
    if (quoteRes.status === 'fulfilled') quoteData = await quoteRes.value.json();
    if (chartRes.status === 'fulfilled') chartData = await chartRes.value.json();
    if (newsRes.status === 'fulfilled') newsData = await newsRes.value.json();
  } catch (e) {}

  let priceContext = '', trend = 'unknown', priceChange30d = 0;
  if (chartData && chartData.c && chartData.c.length > 1) {
    const prices = chartData.c;
    const first = prices[0], last = prices[prices.length - 1];
    priceChange30d = ((last - first) / first * 100).toFixed(2);
    trend = priceChange30d > 2 ? 'uptrend' : priceChange30d < -2 ? 'downtrend' : 'sideways';
    const avg5 = prices.slice(-5).reduce((a,b)=>a+b,0)/5;
    const avg20 = prices.slice(-Math.min(20,prices.length)).reduce((a,b)=>a+b,0)/Math.min(20,prices.length);
    const cp = quoteData?.c || last;
    priceContext = `PRICE DATA (Last 30 Days):
- Current Price: $${cp}
- 30-Day Change: ${priceChange30d}%
- Trend: ${trend}
- 5-Day MA: $${avg5.toFixed(2)}
- 20-Day MA: $${avg20.toFixed(2)}
- 30-Day High: $${Math.max(...prices).toFixed(2)}
- 30-Day Low: $${Math.min(...prices).toFixed(2)}
- Price vs 20-Day MA: ${cp > avg20 ? 'ABOVE (bullish)' : 'BELOW (bearish)'}
- Today Change: ${quoteData?.dp ? quoteData.dp.toFixed(2)+'%' : 'N/A'}`;
  } else {
    priceContext = `Chart data unavailable for ${ticker}. May be a crypto/forex symbol or market is closed.`;
  }

  let newsContext = 'No recent news found.';
  if (newsData?.articles?.length > 0) {
    newsContext = 'RECENT NEWS:\n' + newsData.articles.slice(0,5).map((a,i)=>
      `${i+1}. "${a.title}" (${a.source?.name||'Unknown'}, ${new Date(a.publishedAt).toLocaleDateString()})`
    ).join('\n');
  }

  const analyzePrompt = `You are a professional stock analyst at CapitalEdge. Analyze ${ticker} using the REAL data below.

${priceContext}

${newsContext}

Give your analysis in this EXACT format:

## ${ticker} Analysis

**📊 Current Situation**
[2-3 sentences about current price action based on data]

**🟢 Bull Case**
• [Data-driven point 1]
• [Data-driven point 2]
• [Data-driven point 3]

**🔴 Bear Case**
• [Data-driven point 1]
• [Data-driven point 2]
• [Data-driven point 3]

**📰 News Sentiment**
[1-2 sentences about what recent headlines suggest]

**📈 Technical Reading**
[1-2 sentences about what price chart and MAs suggest]

**🎯 Educated Guess: BUY / HOLD / SELL**
Verdict: [BUY or HOLD or SELL]
Reasoning: [2-3 sentences explaining why based on the data]
Confidence: [Low / Medium / High]

⚠️ IMPORTANT DISCLAIMER: This is an AI-generated educated guess for educational purposes ONLY. It is NOT financial advice. Markets are unpredictable and you could lose money. Always conduct your own research, consult a licensed financial advisor before making any investment decisions, and never invest more than you can afford to lose. CapitalEdge and its AI tools accept no responsibility for financial losses.`;

  const sentimentPrompt = `Analyze ${ticker} sentiment using this real data:

${priceContext}
${newsContext}

Format:
## ${ticker} Sentiment Check
**Overall Sentiment:** [🟢 Bullish / 🟡 Neutral / 🔴 Bearish]
**Momentum:** [Strong/Moderate/Weak] [Up/Down/Sideways]
**News Tone:** [Positive/Neutral/Negative] — [why]
**30-Day Trend:** ${trend} (${priceChange30d}% change)
**Key Catalyst:** [main event or risk to watch]
**Quick Take:** [1-2 sentences on short-term outlook]

⚠️ Disclaimer: AI-generated estimate for educational purposes only. Not financial advice.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama3-70b-8192', max_tokens: 1000, temperature: 0.6,
        messages: [
          { role: 'system', content: 'You are a professional financial analyst. Use the provided real market data. Be direct and data-driven. Always include the disclaimer.' },
          { role: 'user', content: mode === 'sentiment' ? sentimentPrompt : analyzePrompt }
        ]
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return res.status(200).json({ result: data.choices?.[0]?.message?.content || '', ticker, mode, priceChange30d, trend });
  } catch (err) {
    return res.status(500).json({ error: 'AI analysis failed', detail: err.message });
  }
}
