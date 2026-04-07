// api/ai-analyze.js - AI Stock Analysis using Groq + Twelve Data + GNews
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker, mode = 'analyze', question } = req.body;
  const groqKey = process.env.GROQ_API_KEY;
  const tdKey = process.env.TWELVEDATA_API_KEY;
  const gnewsKey = process.env.GNEWS_API_KEY;

  // Chat mode - just answer the question
  if (mode === 'chat') {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', max_tokens: 600, temperature: 0.7,
          messages: [
            { role: 'system', content: 'You are CapitalEdge AI, a financial education assistant. Be clear and helpful. Always end with: "⚠️ Disclaimer: This is for educational purposes only and is NOT financial advice. Always do your own research before investing."' },
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

  // Fetch quote + news in parallel using new APIs
  let quoteData = null;
  let newsData = null;

  try {
    const [quoteRes, newsRes] = await Promise.allSettled([
      fetch(`https://api.twelvedata.com/quote?symbol=${ticker.toUpperCase()}&apikey=${tdKey}`),
      fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(ticker)}&lang=en&max=5&sortby=publishedAt&apikey=${gnewsKey}`)
    ]);
    if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
      quoteData = await quoteRes.value.json();
    }
    if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
      newsData = await newsRes.value.json();
    }
  } catch(e) {}

  // Build price context
  let priceContext = 'Current price data not available.';
  if (quoteData && !quoteData.status === 'error' && quoteData.close) {
    const price = parseFloat(quoteData.close || 0);
    const prevClose = parseFloat(quoteData.previous_close || 0);
    const changePct = parseFloat(quoteData.percent_change || 0);
    const high = parseFloat(quoteData.high || 0);
    const low = parseFloat(quoteData.low || 0);
    const fiftyTwoHigh = parseFloat(quoteData['52_week'] ? quoteData['52_week'].high : 0);
    const fiftyTwoLow = parseFloat(quoteData['52_week'] ? quoteData['52_week'].low : 0);

    priceContext = `LIVE PRICE DATA FOR ${ticker.toUpperCase()}:
- Current Price: $${price.toFixed(2)}
- Today's Change: ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%
- Today's High: $${high.toFixed(2)}
- Today's Low: $${low.toFixed(2)}
- Previous Close: $${prevClose.toFixed(2)}
- Exchange: ${quoteData.exchange || 'US'}
- Today's Signal: ${changePct > 2 ? 'Strong bullish momentum' : changePct > 0.5 ? 'Mild bullish momentum' : changePct < -2 ? 'Strong bearish pressure' : changePct < -0.5 ? 'Mild bearish pressure' : 'Flat / consolidating'}`;
  }

  // Build news context
  let newsContext = 'No recent news found for this ticker.';
  if (newsData?.articles?.length > 0) {
    const headlines = newsData.articles.slice(0, 5).map((a, i) =>
      `${i + 1}. "${a.title}" — ${a.source?.name || 'Unknown'} (${new Date(a.publishedAt).toLocaleDateString()})`
    ).join('\n');
    newsContext = `RECENT NEWS:\n${headlines}`;
  }

  const analyzePrompt = `You are a senior financial analyst at CapitalEdge. Analyze ${ticker.toUpperCase()} using the REAL live data below.

${priceContext}

${newsContext}

Write your analysis using EXACTLY this format:

## ${ticker.toUpperCase()} — Investment Analysis

**📊 Current Situation**
[2-3 sentences about current price action and what the data shows]

**🟢 Bull Case**
• [Bullish point 1 based on data/news]
• [Bullish point 2]
• [Bullish point 3]

**🔴 Bear Case**
• [Bearish point 1 based on data/news]
• [Bearish point 2]
• [Bearish point 3]

**📰 News Sentiment**
[1-2 sentences — is the recent news positive, negative, or neutral for this stock?]

**📈 Price Action**
[1-2 sentences about what today's price movement suggests]

**🎯 Educated Guess**
Verdict: [BUY or HOLD or SELL]
Reasoning: [2-3 sentences explaining the verdict based on the data]
Confidence: [Low or Medium or High] — [one sentence on why this confidence level]

⚠️ IMPORTANT DISCLAIMER: This is an AI-generated educated guess for educational purposes ONLY. It is NOT financial advice and must NOT be used as the sole basis for investment decisions. Stock prices are unpredictable and you could lose money. Always do your own thorough research, consult a licensed financial advisor, and never invest more than you can afford to lose. CapitalEdge and its AI tools accept no liability for any financial losses.`;

  const sentimentPrompt = `Quickly analyze market sentiment for ${ticker.toUpperCase()} using this real data:

${priceContext}
${newsContext}

Use EXACTLY this format:
## ${ticker.toUpperCase()} — Sentiment Check
**Overall Sentiment:** [🟢 Bullish or 🟡 Neutral or 🔴 Bearish]
**Today's Momentum:** [Strong Up / Mild Up / Flat / Mild Down / Strong Down]
**News Tone:** [Positive / Neutral / Negative] — [one sentence why]
**Key Upside Catalyst:** [biggest potential positive catalyst]
**Key Downside Risk:** [biggest risk to watch]
**Quick Take:** [2 sentences on short-term outlook]

⚠️ Disclaimer: AI-generated estimate for educational purposes only. NOT financial advice.`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', max_tokens: 1000, temperature: 0.5,
        messages: [
          { role: 'system', content: 'You are a professional financial analyst. Use only the provided real data. Follow the exact format. Always include the disclaimer.' },
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
