// api/ai-analyze.js - AI Stock Analysis with Buy/Hold/Sell
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker, mode = 'analyze', question } = req.body;
  const groqKey = process.env.GROQ_API_KEY;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const newsKey = process.env.NEWS_API_KEY;

  // Chat mode
  if (mode === 'chat') {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama3-70b-8192', max_tokens: 600, temperature: 0.7,
          messages: [
            { role: 'system', content: 'You are CapitalEdge AI, a helpful financial education assistant. Be clear and concise. Always end with: "⚠️ Disclaimer: This is for educational purposes only and is NOT financial advice. Always do your own research before investing."' },
            { role: 'user', content: question }
          ]
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      return res.status(200).json({ result: data.choices?.[0]?.message?.content || '', ticker: 'Q&A', mode });
    } catch (err) {
      return res.status(500).json({ error: 'AI failed: ' + err.message });
    }
  }

  if (!ticker) return res.status(400).json({ error: 'Ticker required' });

  // Fetch quote + news in parallel (skip chart to avoid rate limits)
  let quoteData = null;
  let newsData = null;

  try {
    const [quoteRes, newsRes] = await Promise.allSettled([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${finnhubKey}`),
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(ticker)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${newsKey}`)
    ]);
    if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
      quoteData = await quoteRes.value.json();
    }
    if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
      newsData = await newsRes.value.json();
    }
  } catch(e) {}

  // Build price context from quote
  let priceContext = 'Price data not available.';
  if (quoteData && quoteData.c && quoteData.c > 0) {
    const change = quoteData.dp || 0;
    const prevClose = quoteData.pc || 0;
    priceContext = `CURRENT PRICE DATA:
- Current Price: $${quoteData.c}
- Today's Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
- Today's High: $${quoteData.h}
- Today's Low: $${quoteData.l}
- Previous Close: $${prevClose}
- Today's Signal: ${change > 1 ? 'Strong upward momentum today' : change < -1 ? 'Strong downward pressure today' : 'Relatively flat today'}`;
  }

  // Build news context
  let newsContext = 'No recent news found for this ticker.';
  if (newsData?.articles?.length > 0) {
    const headlines = newsData.articles.slice(0, 5).map((a, i) =>
      `${i + 1}. "${a.title}" — ${a.source?.name || 'Unknown'} (${new Date(a.publishedAt).toLocaleDateString()})`
    ).join('\n');
    newsContext = `RECENT NEWS HEADLINES:\n${headlines}`;
  }

  const analyzePrompt = `You are a senior stock analyst at CapitalEdge. Analyze ${ticker.toUpperCase()} using the real data provided below and give a structured analysis with a clear investment recommendation.

${priceContext}

${newsContext}

Write your analysis in this EXACT format (use the exact headers):

## ${ticker.toUpperCase()} — Full Analysis

**📊 Current Situation**
[2-3 sentences about what the current price data and news suggest about this stock right now]

**🟢 Bull Case**
• [Bullish argument 1]
• [Bullish argument 2]
• [Bullish argument 3]

**🔴 Bear Case**
• [Bearish argument 1]
• [Bearish argument 2]
• [Bearish argument 3]

**📰 News Sentiment**
[1-2 sentences about what the recent headlines suggest — is the news positive, negative, or neutral?]

**📈 Price Action Reading**
[1-2 sentences about what today's price movement and the data suggest about short-term momentum]

**🎯 Educated Guess**
Verdict: [write exactly one of: BUY or HOLD or SELL]
Reasoning: [2-3 sentences explaining your verdict based on the data above]
Confidence: [write exactly one of: Low or Medium or High] — [one sentence explaining your confidence level]

⚠️ IMPORTANT DISCLAIMER: This is an AI-generated educated guess based on limited publicly available data. It is NOT financial advice and should NOT be used as the sole basis for any investment decision. Stock markets are unpredictable and you could lose money. Always conduct thorough independent research, consult a licensed financial advisor before investing, and never invest money you cannot afford to lose. CapitalEdge, its owners, and its AI tools accept no responsibility for any financial losses you may incur.`;

  const sentimentPrompt = `Analyze market sentiment for ${ticker.toUpperCase()} using this real data:

${priceContext}
${newsContext}

Format:
## ${ticker.toUpperCase()} — Sentiment Check
**Overall Sentiment:** [🟢 Bullish or 🟡 Neutral or 🔴 Bearish]
**Today's Momentum:** [Strong Upward / Moderate Upward / Flat / Moderate Downward / Strong Downward]
**News Tone:** [Positive / Neutral / Negative] — [one sentence why]
**Key Risk:** [biggest risk to watch right now]
**Key Catalyst:** [biggest potential upside catalyst]
**Quick Take:** [2 sentences on short-term outlook]

⚠️ Disclaimer: AI-generated sentiment estimate for educational purposes only. Not financial advice.`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama3-70b-8192', max_tokens: 1000, temperature: 0.5,
        messages: [
          { role: 'system', content: 'You are a professional financial analyst. Use only the provided data. Follow the exact format requested. Always include the disclaimer.' },
          { role: 'user', content: mode === 'sentiment' ? sentimentPrompt : analyzePrompt }
        ]
      })
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    return res.status(200).json({ result: data.choices?.[0]?.message?.content || '', ticker, mode });
  } catch (err) {
    return res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
}
