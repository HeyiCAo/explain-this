# Explain This – Instant AI Explanations

Understand highlighted text instantly without leaving the page.

**50 free AI explanations every day. No API key required.**

Explain This is a lightweight Chrome extension for reading the web with less
friction. Highlight a word, phrase, or passage, click **Explain this**, and get a
clear streaming explanation in English or Chinese.

## Features

- **Built-in AI by default:** install and start immediately, with 50 free
  explanations each day.
- **No API key required:** provider setup and model names stay out of the normal
  user experience.
- **Concise or detailed:** choose a quick three-sentence explanation or a fuller
  breakdown with an example.
- **Privacy-aware site access:** the selection button runs only after you invoke
  the extension, or on sites you explicitly add under **Enabled sites**.
- **Optional local history:** recent explanations and cache can be disabled and
  cleared from Settings.
- **Power-user BYOK:** OpenAI, Gemini, and DeepSeek keys remain available in the
  Advanced section for higher limits or direct provider control.

## Getting started

1. Install the extension.
2. Choose your language and explanation style.
3. Highlight text on a webpage.
4. Click the extension once on that tab, or press `Ctrl+E` / `Cmd+E`, then use
   **Explain this**.

No account or API key is needed. The free allowance resets daily. After 50
explanations, you can return the next day or add your own API key in
**Settings → Advanced / Power User**.

## Site access

Explain This does not install a content script on every website.

- Clicking the toolbar action or using the keyboard shortcut grants temporary
  access to the active tab.
- Add a domain under **Settings → Enabled sites** only if you want the selection
  button to be available automatically there.
- Remove a site at any time to revoke its optional browser permission.

**Only works where you allow it.**

## Free-mode architecture

```text
Chrome extension → Explain This backend → AI provider
```

The extension never contains the free-mode provider key. The backend:

- holds provider credentials as deployment secrets;
- enforces 50 requests per day;
- limits per-minute bursts and applies automatic cooldowns;
- rejects free-mode selections over 1,000 characters;
- applies a broader network abuse backstop;
- returns provider-neutral errors and streaming responses; and
- does not persist selected text in the application database.

The deployable Cloudflare Worker lives in [`backend`](backend/README.md). The
current production build uses
`https://explain-this-api.explainthis-hc907.workers.dev/v1`; set
`VITE_BUILT_IN_API_BASE_URL` when deploying the API at a different base URL.

## Bring your own key

BYOK is optional and lives under **Advanced / Power User**. A personal key is
stored in `chrome.storage.local` and sent directly from the extension to the
chosen provider. It is not sent to the Explain This backend.

## Local development

```bash
npm install
npm run dev
```

Build the extension:

```bash
npm run build
```

Then load the generated `dist` directory as an unpacked extension in Chrome.

## Privacy

Only text you explicitly submit for explanation is processed. See the
[Privacy Policy](privacy-policy.md) for free-mode routing, anonymous quota data,
retention, local history controls, BYOK behavior, and third-party boundaries.

Built with React, Vite, and modern Chrome extension APIs.
