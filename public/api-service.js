// api-service.js
class AIService {
  constructor() {
    this.apiKey = null;
    this.provider = 'deepseek';
    this.baseURL = 'https://api.deepseek.com/v1';
    this.model = 'deepseek-chat';
    this.geminiBaseURL = 'https://generativelanguage.googleapis.com/v1beta';
    this.geminiModel = 'gemini-2.5-flash';
  }

  async loadApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['apiKey', 'geminiApiKey', 'provider'], (result) => {
        this.provider = result.provider || 'deepseek';
        this.apiKey = this.provider === 'gemini' ? (result.geminiApiKey || '') : (result.apiKey || '');
        resolve(this.apiKey);
      });
    });
  }

  async saveApiKey(apiKey) {
    this.apiKey = apiKey;
    return new Promise((resolve) => {
      chrome.storage.local.set({ apiKey }, resolve);
    });
  }

  async explainText(text, options = {}) {
    await this.loadApiKey();
    if (!this.apiKey) throw new Error('Please set up an API key first');

    const prompt = this.buildPrompt(text, options);
    const language = options.language || 'zh';
    const speed = options.speed || 'fast';
    const isFast = speed === 'fast';
    const languageHint = language === 'en' ? 'Use English for the entire response.' : '请全程使用中文回答。';
    const systemHeader = isFast
      ? (language === 'en'
        ? 'You are a concise explainer. Reply with 1 line summary and up to 2 bullets. No examples.'
        : '你是精简解释助手。只要一句话总结 + 不超过2个要点。不要给例子。')
      : '你是一个专业的解释助手。请用简单易懂的语言解释用户输入的内容。';
    const systemContent = `${systemHeader}
              ${!isFast ? `格式要求：
              1. 第一行用一句话总结
              2. 然后分点详细解释
              3. 最后给出相关例子` : ''}
              ${languageHint}`;
    try {
      if (this.provider === 'gemini') {
        return await this.explainWithGemini(prompt, isFast, systemContent);
      }
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemContent
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: isFast ? 180 : 900,
          temperature: isFast ? 0.1 : 0.4
        })
      });

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorData = await response.json();
          errorDetail = JSON.stringify(errorData);
        } catch {
          errorDetail = await response.text();
        }
        throw new Error(`API Call Failure (HTTP ${response.status}): ${errorDetail}`);
      }

      const data = await response.json();
      return this.formatExplanation(data.choices[0].message.content);
    } catch (error) {
      console.error('Error!：', error);
      throw error;
    }
  }

  async explainWithGemini(prompt, isFast, systemContent) {
    const response = await fetch(`${this.geminiBaseURL}/models/${this.geminiModel}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemContent }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: isFast ? 180 : 900,
          temperature: isFast ? 0.1 : 0.4
        }
      })
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = JSON.stringify(errorData);
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(`API Call Failure (HTTP ${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('');
    return this.formatExplanation(text);
  }

  buildPrompt(text, options) {
    const language = options.language || 'zh';
    const prefix = language === 'en' ? 'Explain:' : '请解释：';
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
      .replace(/\n/g, '<br>')
      .replace(/📌/g, '<span class="icon-pin">📌</span>')
      .replace(/💡/g, '<span class="icon-tip">💡</span>');
    const rendered = this.renderMath(html);
    return this.sanitizeHtml(rendered);
  }

  escapeHtml(text) {
    const s = String(text ?? '');
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  sanitizeHtml(html) {
    const allowedTags = new Set([
      'strong', 'em', 'code', 'br', 'span', 'div', 'sub', 'sup'
    ]);
    const allowedClass = new Set([
      'icon-pin', 'icon-tip',
      'math-inline', 'math-display', 'frac', 'num', 'den', 'op'
    ]);

    const template = document.createElement('template');
    template.innerHTML = html;

    const walk = (node) => {
      const children = Array.from(node.childNodes);
      children.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase();
          if (!allowedTags.has(tag)) {
            const text = document.createTextNode(child.textContent || '');
            child.replaceWith(text);
            return;
          }
          Array.from(child.attributes).forEach((attr) => {
            if (attr.name === 'class') {
              const classes = attr.value.split(/\s+/).filter((c) => allowedClass.has(c));
              if (classes.length) {
                child.setAttribute('class', classes.join(' '));
              } else {
                child.removeAttribute('class');
              }
            } else {
              child.removeAttribute(attr.name);
            }
          });
          walk(child);
        }
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

    // frac
    for (let i = 0; i < 3; i += 1) {
      s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (m, a, b) => {
        return `<span class="frac"><span class="num">${a}</span><span class="den">${b}</span></span>`;
      });
    }

    // subscripts and superscripts
    s = s.replace(/_({[^}]+}|[^\s^_])/g, (m) => {
      const val = m.slice(1).replace(/^\{|\}$/g, '');
      return `<sub>${val}</sub>`;
    });
    s = s.replace(/\^({[^}]+}|[^\s^_])/g, (m) => {
      const val = m.slice(1).replace(/^\{|\}$/g, '');
      return `<sup>${val}</sup>`;
    });

    // lim with subscript: \lim_{...}
    s = s.replace(/\\lim<sub>(.*?)<\/sub>/g, (m, sub) => {
      return `<span class="op">lim</span><sub>${sub}</sub>`;
    });
    s = s.replace(/\\lim/g, '<span class="op">lim</span>');

    return s;
  }

  async testApiKey(apiKey) {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
