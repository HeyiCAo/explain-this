const BUILT_IN_API_BASE_URL = (
  import.meta.env.VITE_BUILT_IN_API_BASE_URL
    || 'https://explain-this-api.explainthis-hc907.workers.dev/v1'
).replace(/\/+$/, '');

const STORAGE_KEYS = [
  'aiMode',
  'apiKey',
  'geminiApiKey',
  'openaiApiKey',
  'provider',
  'installId',
];

export class AIServiceError extends Error {
  constructor(code, message = code, details = {}) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.details = details;
  }
}

class AIService {
  constructor() {
    this.apiKey = '';
    this.mode = 'builtIn';
    this.provider = 'openai';
    this.installId = '';

    this.deepseekBaseURL = 'https://api.deepseek.com/v1';
    this.deepseekModel = 'deepseek-chat';
    this.geminiBaseURL = 'https://generativelanguage.googleapis.com/v1beta';
    this.geminiModel = 'gemini-3.5-flash';
    this.openaiBaseURL = 'https://api.openai.com/v1';
    this.openaiModel = 'gpt-5.4-mini';
  }

  getStorage(keys) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
        resolve({});
        return;
      }
      chrome.storage.local.get(keys, resolve);
    });
  }

  setStorage(values) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
        resolve();
        return;
      }
      chrome.storage.local.set(values, resolve);
    });
  }

  async loadConfiguration() {
    const result = await this.getStorage(STORAGE_KEYS);
    const hasSavedKey = [result.apiKey, result.geminiApiKey, result.openaiApiKey]
      .some((key) => String(key || '').trim());

    this.mode = result.aiMode || (hasSavedKey ? 'byok' : 'builtIn');
    this.provider = result.provider || 'openai';
    this.installId = result.installId || '';

    if (this.provider === 'gemini') {
      this.apiKey = result.geminiApiKey || '';
    } else if (this.provider === 'deepseek') {
      this.apiKey = result.apiKey || '';
    } else {
      this.apiKey = result.openaiApiKey || '';
    }
    this.apiKey = String(this.apiKey).trim();

    if (!this.installId) {
      this.installId = globalThis.crypto?.randomUUID?.()
        || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await this.setStorage({ installId: this.installId });
    }

    return {
      mode: this.mode,
      provider: this.provider,
      apiKey: this.apiKey,
      installId: this.installId,
    };
  }

  async explainText(text, options = {}) {
    await this.loadConfiguration();
    if (this.mode === 'builtIn') {
      return this.explainWithBuiltInAI(text, options, false);
    }
    this.assertByokKey();

    const request = this.buildByokRequest(text, options);
    if (this.provider === 'gemini') {
      return this.explainWithGemini(request.prompt, request.isFast, request.systemContent);
    }
    if (this.provider === 'openai') {
      return this.explainWithOpenAI(request.prompt, request.isFast, request.systemContent);
    }
    return this.explainWithDeepSeek(request.prompt, request.isFast, request.systemContent);
  }

  async explainTextStream(text, options = {}, onChunk = () => {}) {
    await this.loadConfiguration();
    if (this.mode === 'builtIn') {
      return this.explainWithBuiltInAI(text, options, true, onChunk);
    }
    this.assertByokKey();

    const request = this.buildByokRequest(text, options);
    if (this.provider === 'gemini') {
      return this.explainGeminiStream(
        request.prompt,
        request.isFast,
        request.systemContent,
        onChunk,
      );
    }
    if (this.provider === 'openai') {
      return this.explainOpenAIStream(
        request.prompt,
        request.isFast,
        request.systemContent,
        onChunk,
      );
    }
    return this.explainDeepSeekStream(
      request.prompt,
      request.isFast,
      request.systemContent,
      onChunk,
    );
  }

  assertByokKey() {
    if (!this.apiKey) {
      throw new AIServiceError(
        'BYOK_KEY_REQUIRED',
        'A personal API key is required in Bring Your Own Key mode.',
      );
    }
  }

  buildByokRequest(text, options) {
    const language = options.language || 'zh';
    const isFast = (options.speed || 'fast') === 'fast';
    return {
      prompt: this.buildPrompt(text, options),
      systemContent: this.buildSystemContent(language, isFast),
      isFast,
    };
  }

  async explainWithBuiltInAI(text, options, stream, onChunk = () => {}) {
    let response;
    try {
      response = await fetch(`${BUILT_IN_API_BASE_URL}/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ExplainThis-Client': this.installId,
        },
        body: JSON.stringify({
          text,
          language: options.language || 'zh',
          style: options.speed || 'fast',
          stream,
        }),
      });
    } catch {
      throw new AIServiceError('SERVICE_UNAVAILABLE');
    }

    await this.storeFreeUsageFromResponse(response);
    if (!response.ok) {
      throw await this.createProxyError(response);
    }

    if (!stream) {
      const data = await response.json();
      return this.formatExplanation(data.explanation || '');
    }

    const fullText = await this.readSseStream(response, (data) => {
      const delta = data.delta || '';
      if (delta) onChunk(delta);
      return delta;
    });
    return this.formatExplanation(fullText);
  }

  async createProxyError(response) {
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // The UI intentionally never exposes raw backend or provider responses.
    }
    const code = payload?.error?.code || (
      response.status === 413
        ? 'TEXT_TOO_LONG'
        : response.status === 429
          ? 'RATE_LIMITED'
          : 'SERVICE_UNAVAILABLE'
    );
    return new AIServiceError(code, code, {
      retryAfter: payload?.error?.retryAfter,
      resetAt: payload?.error?.resetAt,
      maxCharacters: payload?.error?.maxCharacters,
    });
  }

  async storeFreeUsageFromResponse(response) {
    const limit = Number(response.headers.get('X-RateLimit-Limit'));
    const remaining = Number(response.headers.get('X-RateLimit-Remaining'));
    const resetAt = response.headers.get('X-RateLimit-Reset');
    if (!Number.isFinite(limit) || !Number.isFinite(remaining)) return;

    await this.setStorage({
      freeUsage: {
        date: new Date().toISOString().slice(0, 10),
        limit,
        remaining: Math.max(0, remaining),
        resetAt: resetAt || null,
        updatedAt: Date.now(),
      },
    });
  }

  async explainDeepSeekStream(prompt, isFast, systemContent, onChunk) {
    const response = await fetch(`${this.deepseekBaseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.deepseekModel,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
        max_tokens: isFast ? 800 : 2000,
        temperature: isFast ? 0.1 : 0.4,
        stream: true,
      }),
    });

    if (!response.ok) throw new AIServiceError('PROVIDER_ERROR');
    const fullText = await this.readSseStream(response, (data) => {
      const delta = data.choices?.[0]?.delta?.content || '';
      if (delta) onChunk(delta);
      return delta;
    });
    return this.formatExplanation(fullText);
  }

  async explainOpenAIStream(prompt, isFast, systemContent, onChunk) {
    const response = await fetch(`${this.openaiBaseURL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.openaiModel,
        instructions: systemContent,
        input: prompt,
        max_output_tokens: isFast ? 800 : 2000,
        stream: true,
      }),
    });

    if (!response.ok) throw new AIServiceError('PROVIDER_ERROR');
    const fullText = await this.readSseStream(response, (data) => {
      const delta = data.type === 'response.output_text.delta' ? (data.delta || '') : '';
      if (delta) onChunk(delta);
      return delta;
    });
    return this.formatExplanation(fullText);
  }

  async explainGeminiStream(prompt, isFast, systemContent, onChunk) {
    const response = await fetch(
      `${this.geminiBaseURL}/models/${this.geminiModel}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemContent }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: isFast ? 800 : 2000,
            temperature: isFast ? 0.1 : 0.4,
          },
        }),
      },
    );

    if (!response.ok) throw new AIServiceError('PROVIDER_ERROR');
    const fullText = await this.readSseStream(response, (data) => {
      const delta = (data.candidates?.[0]?.content?.parts || [])
        .map((part) => part.text || '')
        .join('');
      if (delta) onChunk(delta);
      return delta;
    });
    return this.formatExplanation(fullText);
  }

  async readSseStream(response, extractDelta) {
    const reader = response.body?.getReader();
    if (!reader) throw new AIServiceError('STREAM_UNAVAILABLE');

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const delta = extractDelta(JSON.parse(payload));
          fullText += delta || '';
        } catch {
          // Ignore provider keepalive or non-content events.
        }
      }
    }
    return fullText;
  }

  buildSystemContent(language, isFast) {
    const languageHint = language === 'en'
      ? 'Use English for the entire response.'
      : '请全程使用中文回答。';
    const systemHeader = isFast
      ? (language === 'en'
        ? 'You are a concise explainer. Give only one short paragraph of at most three sentences.'
        : '你是一个简明的解释助手。请仅用一段不超过三句话的内容说明核心含义。')
      : (language === 'en'
        ? 'You are a professional explainer. Use simple language and include a helpful example.'
        : '你是一个专业的解释助手。请用简单易懂的语言详细解释，并给出有帮助的例子。');
    const formatHint = isFast
      ? ''
      : (language === 'en'
        ? 'Start with a one-sentence summary, then key points, then one relevant example.'
        : '先用一句话总结，再分点说明，最后给出一个相关例子。');
    return `${systemHeader}\n${formatHint}\n${languageHint}`;
  }

  async explainWithDeepSeek(prompt, isFast, systemContent) {
    const response = await fetch(`${this.deepseekBaseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.deepseekModel,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
        max_tokens: isFast ? 800 : 2000,
        temperature: isFast ? 0.1 : 0.4,
      }),
    });
    if (!response.ok) throw new AIServiceError('PROVIDER_ERROR');
    const data = await response.json();
    return this.formatExplanation(data.choices?.[0]?.message?.content || '');
  }

  async explainWithGemini(prompt, isFast, systemContent) {
    const response = await fetch(
      `${this.geminiBaseURL}/models/${this.geminiModel}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemContent }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: isFast ? 800 : 2000,
            temperature: isFast ? 0.1 : 0.4,
          },
        }),
      },
    );
    if (!response.ok) throw new AIServiceError('PROVIDER_ERROR');
    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || '')
      .join('');
    return this.formatExplanation(text);
  }

  async explainWithOpenAI(prompt, isFast, systemContent) {
    const response = await fetch(`${this.openaiBaseURL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.openaiModel,
        instructions: systemContent,
        input: prompt,
        max_output_tokens: isFast ? 800 : 2000,
      }),
    });
    if (!response.ok) throw new AIServiceError('PROVIDER_ERROR');
    const data = await response.json();
    return this.formatExplanation(this.extractOpenAIText(data));
  }

  extractOpenAIText(data) {
    if (data.output_text) return data.output_text;
    return (data.output || [])
      .flatMap((item) => item.content || [])
      .map((content) => content.text || '')
      .join('');
  }

  buildPrompt(text, options) {
    const prefix = (options.language || 'zh') === 'en' ? 'Explain: ' : '请解释：';
    let prompt = `${prefix}${text}`;
    if (options.context) prompt += `\n上下文：${options.context}`;
    return prompt;
  }

  formatExplanation(explanation) {
    const safe = this.escapeHtml(explanation);
    const html = safe
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    return this.sanitizeHtml(this.renderMath(html));
  }

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  sanitizeHtml(html) {
    const allowedTags = new Set(['strong', 'em', 'code', 'br', 'span', 'div', 'sub', 'sup']);
    const allowedClass = new Set(['math-inline', 'math-display', 'frac', 'num', 'den', 'op']);
    const template = document.createElement('template');
    template.innerHTML = html;

    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        const tag = child.tagName.toLowerCase();
        if (!allowedTags.has(tag)) {
          child.replaceWith(document.createTextNode(child.textContent || ''));
          return;
        }
        Array.from(child.attributes).forEach((attr) => {
          if (attr.name === 'class') {
            const classes = attr.value
              .split(/\s+/)
              .filter((className) => allowedClass.has(className));
            classes.length
              ? child.setAttribute('class', classes.join(' '))
              : child.removeAttribute('class');
          } else {
            child.removeAttribute(attr.name);
          }
        });
        walk(child);
      });
    };

    walk(template.content);
    return template.innerHTML;
  }

  renderMath(html) {
    let out = html;
    out = out.replace(/\\\[((?:.|\n)*?)\\\]/g, (match, content) => (
      `<div class="math-display">${this.latexToHtml(content)}</div>`
    ));
    out = out.replace(/\\\((.*?)\\\)/g, (match, content) => (
      `<span class="math-inline">${this.latexToHtml(content)}</span>`
    ));
    return out;
  }

  latexToHtml(latex) {
    if (!latex) return '';
    let value = latex
      .replace(/\\Delta/g, 'Δ')
      .replace(/\\to/g, '→')
      .replace(/\\infty/g, '∞')
      .replace(/\\cdot/g, '·')
      .replace(/\\times/g, '×')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥');

    for (let index = 0; index < 3; index += 1) {
      value = value.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (match, top, bottom) => (
        `<span class="frac"><span class="num">${top}</span><span class="den">${bottom}</span></span>`
      ));
    }

    value = value.replace(/_({[^}]+}|[^\s^_])/g, (match) => {
      const subscript = match.slice(1).replace(/^\{|\}$/g, '');
      return `<sub>${subscript}</sub>`;
    });
    value = value.replace(/\^({[^}]+}|[^\s^_])/g, (match) => {
      const superscript = match.slice(1).replace(/^\{|\}$/g, '');
      return `<sup>${superscript}</sup>`;
    });
    value = value.replace(
      /\\lim<sub>(.*?)<\/sub>/g,
      (match, subscript) => `<span class="op">lim</span><sub>${subscript}</sub>`,
    );
    return value.replace(/\\lim/g, '<span class="op">lim</span>');
  }
}

export default AIService;
