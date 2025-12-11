# CalendarEvent.link

Free calendar link generator for Google Calendar, Outlook, Yahoo & more.

## Features

- **Single Event**: Create links for one event
- **Bulk Events**: Generate links for multiple events at once
- **AI Chat**: Describe events naturally and get links automatically

## Setup on Vercel

### 1. Deploy to Vercel

Push this code to GitHub, then import to Vercel.

### 2. Add Environment Variable

In Vercel Dashboard:
1. Go to your project → **Settings** → **Environment Variables**
2. Add:
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: Your Anthropic API key (starts with `sk-ant-...`)
3. Click **Save**
4. **Redeploy** the project for changes to take effect

### 3. Configure Beehiiv (Optional)

To enable email signups:
1. Get your Beehiiv form URL from Beehiiv → Settings → Embeds
2. Update the `BEEHIIV_FORM_URL` in `index.html`

## Rate Limiting

The AI Chat feature has rate limiting:
- **Default (server key)**: 10 requests per hour per user
- **Own API key**: No limit

## Built by

[Selim Uysal](https://selimuysal.net)
