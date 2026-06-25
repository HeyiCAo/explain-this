# Explain This

**Explain This** is a lightweight, AI-powered Chrome extension designed to help you quickly understand any text on the web without breaking your flow. Simply select a word, phrase, or paragraph, and get instant, streaming explanations right where you are.

## Features

- **Seamless Interaction:** Select any text and click the floating button (or use `Ctrl+E` / `Cmd+E`) to get an instant explanation.
- **Multiple AI Providers:** Choose your preferred AI backend. Currently supports:
  - **DeepSeek** (deepseek-chat)
  - **Google Gemini** (gemini-3.5-flash)
  - **OpenAI** (gpt-5.4-mini)
- **Speed Modes:**
  - **Fast:** A highly concise, one-paragraph summary. Gets straight to the point.
  - **Detail:** A comprehensive explanation with bullet points and examples.
- **Bilingual Support:** Generate explanations in English or Chinese, regardless of the source text language.
- **Local History & Caching:** Instantly retrieve recent explanations without re-requesting the API.
- **Usage Statistics:** Keep track of your local API requests and estimated token usage.

## Getting Started

1. Install the extension in your browser.
2. Click the extension icon or use the gear icon in the popup to open **Settings**.
3. Select your preferred AI Provider and enter your API Key.
   - *DeepSeek API Key (sk-...)*
   - *Gemini API Key (AIza...)*
   - *OpenAI API Key (sk-...)*
4. Save the key and you are ready to go!

## How to Use

1. **Highlight Text:** Select any text on a webpage.
2. **Click the Button:** A sleek floating button will appear near your cursor. Click it to trigger the AI.
3. **Alternatively, use Hotkeys:** Press `Ctrl+E` (Windows/Linux) or `Cmd+E` (Mac).
4. **Manual Entry:** You can also click the extension icon in your toolbar to manually type or paste text into the popup.

## Privacy First

Your privacy is paramount. "Explain This" only sends the text you explicitly select to the AI provider you configure. We do not track your browsing history or store your API keys on external servers (all keys are stored locally in your browser).

---
*Built with React, Vite, and modern web standards.*
