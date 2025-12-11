// Serverless function to handle Claude API calls securely
// Rate limiting: 10 requests per hour per IP

const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// Simple in-memory rate limiting (resets on cold start, but good enough for basic protection)
const rateLimitMap = new Map();

function getRateLimitKey(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         'unknown';
}

function checkRateLimit(key) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(key);
  
  if (!userLimit) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (now > userLimit.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: userLimit.resetAt };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT - userLimit.count };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { messages, userApiKey } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages are required' });
  }
  
  // Determine which API key to use
  let apiKey = userApiKey;
  let usingUserKey = !!userApiKey;
  
  if (!userApiKey) {
    // Use server API key with rate limiting
    apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'Server API key not configured' });
    }
    
    // Check rate limit only for server key usage
    const rateLimitKey = getRateLimitKey(req);
    const rateLimit = checkRateLimit(rateLimitKey);
    
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    
    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
      return res.status(429).json({ 
        error: `Rate limit exceeded. Try again in ${resetIn} minutes, or use your own API key.`,
        resetIn: resetIn
      });
    }
  }
  
  const systemPrompt = `You are a calendar event assistant. When users describe events they want to create, extract the information and return a JSON array of events.

Each event should have this format:
{
  "title": "Event name",
  "start": "2025-01-15T09:00:00",
  "end": "2025-01-15T10:00:00",
  "description": "Optional description",
  "location": "Optional location",
  "allDay": false
}

For recurring events, generate each individual occurrence.
Always use ISO 8601 datetime format.
If the user doesn't specify a year, use 2025.
If duration isn't specified, default to 1 hour.
For "every Monday for 4 weeks" type requests, generate 4 separate events.

Return ONLY the JSON array, no other text. If you need clarification, ask a question instead.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    return res.status(200).json({ 
      content: data.content[0].text,
      usingUserKey 
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}
