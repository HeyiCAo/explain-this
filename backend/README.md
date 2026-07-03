# Explain This API

Cloudflare Worker proxy for the extension's free Built-in AI mode.

It keeps the provider key server-side, enforces the 50-request daily allowance in a
SQLite-backed Durable Object, applies per-minute and network abuse limits, rejects
oversized selections, and converts provider streaming responses into a
provider-neutral SSE format. Request text is forwarded in memory and is not written
to Worker storage by this application.

## Deploy

1. Install the backend dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Add production secrets:

   ```bash
   npx wrangler secret put AI_API_KEY
   npx wrangler secret put AI_MODEL
   npx wrangler secret put ABUSE_HASH_SALT
   ```

3. Set `ALLOWED_EXTENSION_IDS` in `wrangler.toml` to the production Chrome
   extension ID. Multiple IDs may be comma-separated.

4. Deploy:

   ```bash
   npm run deploy
   ```

5. Route the Worker through `https://api.explainthis.app`, or set
   `VITE_BUILT_IN_API_BASE_URL` to the deployed `/v1` base URL and update the
   extension's required API host permission before building.

The configured upstream must expose an OpenAI-compatible
`/chat/completions` endpoint. `AI_MODEL` is deliberately server-side, so the
extension UI and releases do not depend on a provider model name.

## Local development

Copy `.dev.vars.example` to `.dev.vars`, fill in development-only values, then run:

```bash
npm run dev
```

Never commit `.dev.vars` or a provider key.
