class AIService {
  constructor() {
    this.apiKey = null;
    this.provider = 'openai';
    this.baseURL = 'https://api.deepseek.com/v1';
    this.model = 'deepseek-chat';

    this.geminiBaseURL = 'https://generativelanguage.googleapis.com/v1beta';
    this.geminiModel = 'gemini-3.5-flash';

    this.openaiBaseURL = 'https://api.openai.com/v1';
    this.openaiModel = 'gpt-5.4-mini';
  }

  async loadApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['apiKey', 'geminiApiKey', 'openaiApiKey', 'provider'], (result) => {
        this.provider = result.provider || 'openai';
        if (this.provider === 'gemini') {
            this.apiKey = result.geminiApiKey || '';
        } else if (this.provider === 'openai') {
            this.apiKey = result.openaiApiKey || '';
        } else {
            this.apiKey = result.apiKey || '';
        }
        this.apiKey = String(this.apiKey).trim();
        resolve(this.apiKey);
      });
    });
  }

  async explainText(text, options = {}) {
    await this.loadApiKey();
    if (!this.apiKey) {
      throw new Error('Please set up an API key first');
    }

    const prompt = this.buildPrompt(text, options);
    const language = options.language || 'zh';
    const speed = options.speed || 'fast';
    const isFast = speed === 'fast';
    const systemContent = this.buildSystemContent(language, isFast);

    if (this.provider === 'gemini') {
      return this.explainWithGemini(prompt, isFast, systemContent);
    }
    if (this.provider === 'openai') {
      return this.explainWithOpenAI(prompt, isFast, systemContent);
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
        max_tokens: isFast ? 800 : 2000,
        temperature: isFast ? 0.1 : 0.4,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Call Failure (HTTP ${response.status}): ${await this.readError(response)}`);
    }

    const data = await response.json();
    return this.formatExplanation(data.choices?.[0]?.message?.content || '');
  }

  async explainTextStream(text, options = {}, onChunk = () => {}) {
    await this.loadApiKey();
    if (!this.apiKey) {
      throw new Error('Please set up an API key first');
    }

    const prompt = this.buildPrompt(text, options);
    const language = options.language || 'zh';
    const speed = options.speed || 'fast';
    const isFast = speed === 'fast';
    const systemContent = this.buildSystemContent(language, isFast);

    if (this.provider === 'gemini') {
      return this.explainGeminiStream(prompt, isFast, systemContent, onChunk);
    }
    if (this.provider === 'openai') {
      return this.explainOpenAIStream(prompt, isFast, systemContent, onChunk);
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
        max_tokens: isFast ? 800 : 2000,
        temperature: isFast ? 0.1 : 0.4,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Call Failure (HTTP ${response.status}): ${await this.readError(response)}`);
    }

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
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.openaiModel,
        instructions: systemContent,
        input: prompt,
        max_output_tokens: isFast ? 800 : 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Call Failure (HTTP ${response.status}): ${await this.readError(response)}`);
    }

    const fullText = await this.readSseStream(response, (data) => {
      const delta = data.type === 'response.output_text.delta' ? (data.delta || '') : '';
      if (delta) onChunk(delta);
      return delta;
    });
    return this.formatExplanation(fullText);
  }

  async explainGeminiStream(prompt, isFast, systemContent, onChunk) {
    const response = await fetch(`${this.geminiBaseURL}/models/${this.geminiModel}:streamGenerateContent?alt=sse`, {
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
    });

    if (!response.ok) {
      throw new Error(`API Call Failure (HTTP ${response.status}): ${await this.readError(response)}`);
    }

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
    if (!reader) {
      throw new Error('Streaming response is not supported in this browser');
    }

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
        } catch (error) {
          console.warn('Failed to parse stream chunk', error);
        }
      }
    }

    return fullText;
  }

  buildSystemContent(language, isFast) {
    const languageHint = language === 'en' ? 'Use English for the entire response.' : '请全程使用中文回答。';
    const systemHeader = isFast
      ? (language === 'en'
        ? 'You are a highly concise dictionary assistant. Provide ONLY a single short paragraph (maximum 3 sentences) summarizing the core meaning. Do NOT output any bullet points, lists, examples, or extra details.'
        : '你是一个极简词典助手。请仅用一段简短的话（最多3句话）总结核心含义。绝不能输出任何列表、要点、例子或多余细节，说完即止。')
      : (language === 'en'
        ? 'You are a professional explainer. Use simple language and include helpful examples.'
        : '你是一个专业的解释助手。请用简单易懂的语言详细解释用户输入的内容。');
    return `${systemHeader}
${!isFast ? (language === 'en'
    ? 'Format: first give a one-sentence summary, then explain in bullets, then include a relevant example.'
    : '格式要求：1. 第一行用一句话总结 2. 然后分点详细解释 3. 最后给出相关例子') : ''}
${languageHint}`;
  }

  async explainWithGemini(prompt, isFast, systemContent) {
    const response = await fetch(`${this.geminiBaseURL}/models/${this.geminiModel}:generateContent`, {
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
    });

    if (!response.ok) {
      throw new Error(`API Call Failure (HTTP ${response.status}): ${await this.readError(response)}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((part) => part.text || '').join('');
    return this.formatExplanation(text);
  }

  async explainWithOpenAI(prompt, isFast, systemContent) {
    const response = await fetch(`${this.openaiBaseURL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.openaiModel,
        instructions: systemContent,
        input: prompt,
        max_output_tokens: isFast ? 800 : 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Call Failure (HTTP ${response.status}): ${await this.readError(response)}`);
    }

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

  async readError(response) {
    try {
      return JSON.stringify(await response.json());
    } catch {
      return response.text();
    }
  }

  buildPrompt(text, options) {
    const language = options.language || 'zh';
    const prefix = language === 'en' ? 'Explain:' : '请解释：';
    let prompt = `${prefix}${text}`;
    if (options.context) {
      prompt += `\n上下文：${options.context}`;
    }
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
            const classes = attr.value.split(/\s+/).filter((className) => allowedClass.has(className));
            classes.length ? child.setAttribute('class', classes.join(' ')) : child.removeAttribute('class');
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
    out = out.replace(/\\\[((?:.|\n)*?)\\\]/g, (match, content) => {
      return `<div class="math-display">${this.latexToHtml(content)}</div>`;
    });
    out = out.replace(/\\\((.*?)\\\)/g, (match, content) => {
      return `<span class="math-inline">${this.latexToHtml(content)}</span>`;
    });
    return out;
  }

  latexToHtml(latex) {
    if (!latex) return '';
    let s = latex;
    s = s.replace(/\\Delta/g, 'Δ')
      .replace(/\\to/g, '→')
      .replace(/\\infty/g, '∞')
      .replace(/\\cdot/g, '·')
      .replace(/\\times/g, '×')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥');

    for (let i = 0; i < 3; i += 1) {
      s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (match, a, b) => {
        return `<span class="frac"><span class="num">${a}</span><span class="den">${b}</span></span>`;
      });
    }

    s = s.replace(/_({[^}]+}|[^\s^_])/g, (match) => {
      const val = match.slice(1).replace(/^\{|\}$/g, '');
      return `<sub>${val}</sub>`;
    });
    s = s.replace(/\^({[^}]+}|[^\s^_])/g, (match) => {
      const val = match.slice(1).replace(/^\{|\}$/g, '');
      return `<sup>${val}</sup>`;
    });
    s = s.replace(/\\lim<sub>(.*?)<\/sub>/g, (match, sub) => `<span class="op">lim</span><sub>${sub}</sub>`);
    return s.replace(/\\lim/g, '<span class="op">lim</span>');
  }
}

export default AIService;
