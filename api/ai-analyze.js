module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker, mode = 'analyze', question } = req.body;
  const key = process.env.GROQ_API_KEY;

  const prompts = {
    analyze: `You are an expert financial analyst. Analyze the stock ticker "${ticker}". Provide a structured analysis with: 1. **Company Overview** 2. **Bull Case** (3 bullets) 3. **Bear Case** (3 bullets) 4. **Key Metrics to Watch** 5. **Overall Sentiment**: Bullish/Neutral/Bearish. Be concise. Not financial advice.`,
    sentiment: `You are a market sentiment analyst. For "${ticker}" provide: 1. **Sentiment**: Bullish/Bearish/Neutral 2. **Momentum**: Strong/Moderate/Weak 3. **Key Catalysts** 4. **Analyst Consensus**. Under 150 words.`,
    chat: `You are CapitalEdge AI, a helpful financial education assistant. Answer this question clearly: ${question}. Add a disclaimer that this is not financial advice.`
  };

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        max_tokens: 800,
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'You are a professional financial analyst. Always remind users your analysis is not financial advice.' },
          { role: 'user', content: prompts[mode] || prompts.analyze }
        ]
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ result: text, ticker, mode });
  } catch (err) {
    return res.status(500).json({ error: 'AI analysis failed', detail: err.message });
  }
}
