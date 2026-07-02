import { useState, useCallback, useEffect, useRef } from 'react';
import '../styles.css';
import '../Stream.css';
import AIService from '../shared/apiService';
import { recordUsage } from '../shared/usageStats';

// ========== 工具函数 ==========
const hasExtensionStorage = () => typeof chrome !== 'undefined' && chrome?.storage?.local;
const getStorage = (keys) => new Promise(resolve => {
  if (!hasExtensionStorage()) {
    resolve({});
    return;
  }
  chrome.storage.local.get(keys, resolve);
});

const setStorage = (values) => new Promise(resolve => {
  if (!hasExtensionStorage()) {
    resolve();
    return;
  }
  chrome.storage.local.set(values, resolve);
});

// ========== 国际化 ==========
const popupZh = {
  app_title: 'Explain This',
  input_placeholder: "粘贴或输入你不懂的内容...\n例如：'内卷是什么意思？'\n      'Python中的装饰器怎么理解？'\n      '这个历史典故有什么背景？'",
  ask_ai: '发送',
  speed_label: '速度',
  speed_fast: '快',
  speed_detail: '详',
  results_title: '结果',
  thinking: '思考中...',
  history_title: '最近记录',
  clear_history: '清空',
  empty_input: '请输入要解释的内容',
  api_error_prefix: '解释失败：',
  retry: '重试'
};

const popupEn = {
  app_title: 'Explain This',
  input_placeholder: "Paste or type what you don't understand...",
  ask_ai: 'Ask',
  speed_label: 'Speed',
  speed_fast: 'Fast',
  speed_detail: 'Detail',
  results_title: 'Results',
  thinking: 'Thinking...',
  history_title: 'Recent',
  clear_history: 'Clear',
  empty_input: 'Please enter text to explain',
  api_error_prefix: 'Failed to explain: ',
  retry: 'Try Again'
};

const onboardingZh = {
  eyebrow: '欢迎使用 Explain This',
  step: '第 {current} 步，共 4 步',
  back: '返回',
  continue: '继续',
  languageTitle: '选择你的使用语言',
  languageBody: '这会决定界面和 AI 回答的默认语言，之后仍可随时切换。',
  chinese: '中文',
  chineseHint: '使用中文界面和回答',
  english: 'English',
  englishHint: 'Use the app and AI in English',
  noticeTitle: '使用前，请了解 API Key',
  principleTitle: '它是怎么工作的？',
  principleBody: '扩展会把文本交给 AI 服务商处理；API Key 用来识别并授权你的账户。',
  principleAnalogy: '打个比方：就像刷自己的门卡请前台办事——扩展负责传话，服务商真正处理请求，Key 决定服务记到谁的账户。',
  noticePrivacyTitle: '会发送什么？',
  noticePrivacyBody: '你要求解释的文本会发送给所选服务商。请勿提交密码、密钥或其他敏感信息。',
  noticeRiskTitle: '你需要承担什么？',
  noticeRiskBody: '你需要负责保管 Key、服务商账户的使用和相关费用；如果 Key 泄露，请立即撤销。',
  localKeyNote: 'Key 只保存在此浏览器的本地扩展存储中。',
  privacyPolicy: '查看隐私政策',
  agree: '我已了解并同意继续',
  providerTitle: '选择 AI 服务商',
  providerBody: '选择你已经拥有账户或准备申请 API Key 的服务商。',
  recommended: '推荐',
  freeAvailable: '可用免费',
  providerOpenAI: '通用且稳定，适合大多数内容',
  providerGemini: 'Google 的生成式 AI 服务',
  providerDeepSeek: '中文体验好，价格较低',
  keyTitle: '连接 {provider}',
  keyBody: '粘贴你的 API Key。你可以先测试，确认无误后保存并开始使用。',
  keyLabel: '{provider} API Key',
  keyPlaceholder: '在这里粘贴 API Key',
  getKey: '获取 {provider} API Key',
  test: '测试连接',
  testing: '正在测试…',
  save: '保存并开始使用',
  saving: '正在保存…',
  enterKey: '请先输入 API Key',
  testSuccess: '连接成功，可以开始使用。',
  saved: '设置已保存。',
  connectionFailed: '连接失败'
};

const onboardingEn = {
  eyebrow: 'Welcome to Explain This',
  step: 'Step {current} of 4',
  back: 'Back',
  continue: 'Continue',
  languageTitle: 'Choose your language',
  languageBody: 'This sets the default language for the interface and AI responses. You can change it later.',
  chinese: '中文',
  chineseHint: '使用中文界面和回答',
  english: 'English',
  englishHint: 'Use the app and AI in English',
  noticeTitle: 'Before you begin: API Keys',
  principleTitle: 'How does it work?',
  principleBody: 'The extension sends text to an AI provider. Your API Key identifies and authorizes your account.',
  principleAnalogy: 'Think of a hotel concierge: the extension passes on your request, the provider does the work, and the key says which account receives the service.',
  noticePrivacyTitle: 'What is sent?',
  noticePrivacyBody: 'Your text goes to the selected provider. Never submit passwords, keys, or sensitive data.',
  noticeRiskTitle: 'What are you responsible for?',
  noticeRiskBody: 'You are responsible for your key, provider usage, and charges. Revoke a leaked key immediately.',
  localKeyNote: 'Your key is stored only in this browser’s local extension storage.',
  privacyPolicy: 'Read the Privacy Policy',
  agree: 'I understand and agree to continue',
  providerTitle: 'Choose an AI provider',
  providerBody: 'Pick a provider where you already have an account or plan to create an API Key.',
  recommended: 'Recommended',
  freeAvailable: 'Free tier',
  providerOpenAI: 'Reliable general-purpose explanations',
  providerGemini: 'Google’s generative AI service',
  providerDeepSeek: 'Strong Chinese support at a lower cost',
  keyTitle: 'Connect {provider}',
  keyBody: 'Paste your API Key. You can test it first, then save it and start using Explain This.',
  keyLabel: '{provider} API Key',
  keyPlaceholder: 'Paste your API Key here',
  getKey: 'Get a {provider} API Key',
  test: 'Test connection',
  testing: 'Testing…',
  save: 'Save and start',
  saving: 'Saving…',
  enterKey: 'Enter an API Key first',
  testSuccess: 'Connection successful. You’re ready to go.',
  saved: 'Setup saved.',
  connectionFailed: 'Connection failed'
};

const providerOptions = [
  {
    id: 'openai',
    name: 'OpenAI',
    descriptionKey: 'providerOpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    recommended: true
  },
  {
    id: 'gemini',
    name: 'Gemini',
    descriptionKey: 'providerGemini',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    freeAvailable: true
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    descriptionKey: 'providerDeepSeek',
    keyUrl: 'https://platform.deepseek.com/api_keys'
  }
];

const formatOnboardingText = (text, values) => (
  Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, value), text)
);

async function testProviderConnection(provider, apiKey) {
  let response;
  if (provider === 'gemini') {
    response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }],
        generationConfig: { maxOutputTokens: 32, temperature: 0 }
      })
    });
  } else {
    const url = provider === 'openai'
      ? 'https://api.openai.com/v1/models'
      : 'https://api.deepseek.com/v1/models';
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  }

  if (response.ok) return;

  const rawBody = await response.text();
  let details = rawBody || response.statusText;
  try {
    const payload = JSON.parse(rawBody);
    details = payload?.error?.message || details;
  } catch {
    // Keep the provider's plain-text response.
  }
  throw new Error(`HTTP ${response.status}${details ? `: ${details}` : ''}`);
}

// ========== 简单内存缓存 ==========
function useSimpleCache() {
  const cacheRef = useRef({});

  useEffect(() => {
    getStorage(['explainCache']).then(result => {
      const list = result.explainCache || [];
      const newCache = { ...cacheRef.current };
      list.forEach(item => {
        if (item && item.key) {
          newCache[item.key] = item;
        }
      });
      cacheRef.current = newCache;
    });
  }, []);

  const normalizeKey = (text, language, speed) => {
    const base = text.trim();
    if (!language) return base;
    if (!speed) return `${base}::${language}`;
    return `${base}::${language}::${speed}`;
  };

  const getCache = useCallback((text, language, speed) => {
    const key = normalizeKey(text, language, speed);
    return cacheRef.current[key] || null;
  }, []);

  const upsertCache = useCallback((text, explanation, language, speed) => {
    const key = normalizeKey(text, language, speed);
    cacheRef.current[key] = {
      key,
      text: text.substring(0, 200),
      explanation,
      language,
      speed,
      updatedAt: Date.now()
    };
    getStorage(['explainCache']).then(result => {
      const list = result.explainCache || [];
      const newList = [cacheRef.current[key], ...list.filter(i => i.key !== key)].slice(0, 100);
      setStorage({ explainCache: newList });
    });
  }, []);

  return { getCache, upsertCache };
}

// ========== 子组件 ==========
function HistoryItem({ item, onClick }) {
  return (
    <div className="history-item" onClick={onClick}>
      <span className="history-item-text">{item.text}</span>
      <span className="history-item-meta">
        {(item.language || 'zh').toUpperCase()} · {item.timestamp}
      </span>
    </div>
  );
}

function LoadingSpinner({ text }) {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-text">{text}</p>
    </div>
  );
}

function ResultError({ message }) {
  return (
    <div className="result-error">
      {message}
    </div>
  );
}

function ResultSuccess({ html }) {
  return (
    <div id="resultContent" className="result-content" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function ResultStreaming({ text }) {
  return (
    <div className="stream-container">
      <div className="stream-content">{text}</div>
      <span className="stream-cursor">▊</span>
    </div>
  );
}

function WelcomeFlow({ language, initialProvider, onLanguageChange, onComplete }) {
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState(initialProvider || 'openai');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = language === 'zh' ? onboardingZh : onboardingEn;
  const selectedProvider = providerOptions.find(option => option.id === provider) || providerOptions[0];
  const privacyUrl = 'https://github.com/HeyiCAo/ExplainThis/blob/main/privacy-policy.md';

  const goToStep = (nextStep) => {
    setStatus({ message: '', type: '' });
    setStep(nextStep);
  };

  const handleTest = async () => {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      setStatus({ message: t.enterKey, type: 'error' });
      return;
    }

    setTesting(true);
    setStatus({ message: '', type: '' });
    try {
      await testProviderConnection(provider, normalizedKey);
      setStatus({ message: t.testSuccess, type: 'success' });
    } catch (error) {
      setStatus({ message: `${t.connectionFailed}: ${error.message}`, type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      setStatus({ message: t.enterKey, type: 'error' });
      return;
    }

    const keyPayload = provider === 'gemini'
      ? { geminiApiKey: normalizedKey }
      : provider === 'openai'
        ? { openaiApiKey: normalizedKey }
        : { apiKey: normalizedKey };

    setSaving(true);
    await setStorage({
      ...keyPayload,
      provider,
      lang: language,
      onboardingComplete: true
    });
    setStatus({ message: t.saved, type: 'success' });
    setSaving(false);
    onComplete();
  };

  return (
    <main className={`welcome-container step-${step}`}>
      <div className="welcome-topline">
        <span className="welcome-brand">{t.eyebrow}</span>
        <span className="welcome-step">{formatOnboardingText(t.step, { current: step })}</span>
      </div>

      <div className="welcome-progress" aria-hidden="true">
        {[1, 2, 3, 4].map(item => (
          <span key={item} className={item <= step ? 'active' : ''}></span>
        ))}
      </div>

      {step === 1 && (
        <section className="welcome-page">
          <div className="welcome-icon" aria-hidden="true">文</div>
          <div>
            <h1>{t.languageTitle}</h1>
            <p className="welcome-intro">{t.languageBody}</p>
          </div>
          <div className="welcome-choice-list">
            <button
              className={`welcome-choice ${language === 'zh' ? 'selected' : ''}`}
              onClick={() => onLanguageChange('zh')}
            >
              <span className="welcome-choice-mark">中</span>
              <span><strong>{t.chinese}</strong><small>{t.chineseHint}</small></span>
              <span className="welcome-radio" aria-hidden="true"></span>
            </button>
            <button
              className={`welcome-choice ${language === 'en' ? 'selected' : ''}`}
              onClick={() => onLanguageChange('en')}
            >
              <span className="welcome-choice-mark">A</span>
              <span><strong>{t.english}</strong><small>{t.englishHint}</small></span>
              <span className="welcome-radio" aria-hidden="true"></span>
            </button>
          </div>
          <div className="welcome-actions single">
            <button className="welcome-primary" onClick={() => goToStep(2)}>{t.continue}</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="welcome-page notice-page">
          <div className="welcome-icon notice" aria-hidden="true">!</div>
          <h1>{t.noticeTitle}</h1>
          <div className="principle-box">
            <strong>{t.principleTitle}</strong>
            <p>{t.principleBody}</p>
            <p className="principle-analogy">{t.principleAnalogy}</p>
          </div>
          <div className="notice-list">
            <div>
              <span aria-hidden="true">↗</span>
              <p><strong>{t.noticePrivacyTitle}</strong>{t.noticePrivacyBody}</p>
            </div>
            <div>
              <span aria-hidden="true">◇</span>
              <p><strong>{t.noticeRiskTitle}</strong>{t.noticeRiskBody}</p>
            </div>
          </div>
          <p className="local-key-note">{t.localKeyNote}</p>
          <a className="welcome-link" href={privacyUrl} target="_blank" rel="noreferrer">
            {t.privacyPolicy} ↗
          </a>
          <div className="welcome-actions">
            <button className="welcome-secondary" onClick={() => goToStep(1)}>{t.back}</button>
            <button className="welcome-primary" onClick={() => goToStep(3)}>{t.agree}</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="welcome-page">
          <div className="welcome-icon" aria-hidden="true">AI</div>
          <div>
            <h1>{t.providerTitle}</h1>
            <p className="welcome-intro">{t.providerBody}</p>
          </div>
          <div className="provider-choice-list">
            {providerOptions.map(option => (
              <button
                key={option.id}
                className={`provider-choice ${provider === option.id ? 'selected' : ''}`}
                onClick={() => {
                  if (option.id !== provider) setApiKey('');
                  setProvider(option.id);
                  setStatus({ message: '', type: '' });
                }}
              >
                <span className={`provider-logo ${option.id}`}>{option.name.charAt(0)}</span>
                <span>
                  <strong>
                    {option.name}
                    {option.recommended && <em>{t.recommended}</em>}
                    {option.freeAvailable && <em className="free-badge">{t.freeAvailable}</em>}
                  </strong>
                  <small>{t[option.descriptionKey]}</small>
                </span>
                <span className="welcome-radio" aria-hidden="true"></span>
              </button>
            ))}
          </div>
          <div className="welcome-actions">
            <button className="welcome-secondary" onClick={() => goToStep(2)}>{t.back}</button>
            <button className="welcome-primary" onClick={() => goToStep(4)}>{t.continue}</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="welcome-page">
          <div className={`welcome-icon provider ${provider}`} aria-hidden="true">
            {selectedProvider.name.charAt(0)}
          </div>
          <div>
            <h1>{formatOnboardingText(t.keyTitle, { provider: selectedProvider.name })}</h1>
            <p className="welcome-intro">{t.keyBody}</p>
          </div>
          <label className="welcome-key-field">
            <span>{formatOnboardingText(t.keyLabel, { provider: selectedProvider.name })}</span>
            <input
              type="password"
              value={apiKey}
              onChange={event => {
                setApiKey(event.target.value);
                setStatus({ message: '', type: '' });
              }}
              placeholder={t.keyPlaceholder}
              autoComplete="off"
              spellCheck="false"
            />
          </label>
          <div className="welcome-key-meta">
            <a className="welcome-link" href={selectedProvider.keyUrl} target="_blank" rel="noreferrer">
              {formatOnboardingText(t.getKey, { provider: selectedProvider.name })} ↗
            </a>
            <span>{t.localKeyNote}</span>
          </div>
          {status.message && (
            <div className={`welcome-status ${status.type}`} role="status">{status.message}</div>
          )}
          <div className="welcome-actions key-actions">
            <button className="welcome-secondary back-only" onClick={() => goToStep(3)}>{t.back}</button>
            <button className="welcome-secondary" onClick={handleTest} disabled={testing || saving}>
              {testing ? t.testing : t.test}
            </button>
            <button className="welcome-primary" onClick={handleSave} disabled={testing || saving}>
              {saving ? t.saving : t.save}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

// ========== 主组件 ==========
function Popup() {
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState('en');
  const [speed, setSpeed] = useState('fast');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(null);
  const [initialProvider, setInitialProvider] = useState('openai');

  const langWrapRef = useRef(null);
  const aiServiceRef = useRef(new AIService());
  const { getCache, upsertCache } = useSimpleCache();
  const t = language === 'zh' ? popupZh : popupEn;

  // 初始化
  useEffect(() => {
    getStorage([
      'lang',
      'explainSpeed',
      'history',
      'lastSelectedText',
      'shouldAutoFill',
      'onboardingComplete',
      'provider',
      'apiKey',
      'geminiApiKey',
      'openaiApiKey'
    ]).then(result => {
      let currentLang = language;
      let currentSpeed = speed;
      const hasSavedKey = [result.apiKey, result.geminiApiKey, result.openaiApiKey]
        .some(key => String(key || '').trim());
      const setupComplete = result.onboardingComplete === true || hasSavedKey;
      
      if (result.lang) {
        setLanguage(result.lang);
        currentLang = result.lang;
      }
      if (result.explainSpeed) {
        setSpeed(result.explainSpeed);
        currentSpeed = result.explainSpeed;
      }
      if (result.history) setHistoryList(result.history);
      if (result.provider) setInitialProvider(result.provider);
      setOnboardingRequired(!setupComplete);

      if (hasSavedKey && result.onboardingComplete !== true) {
        setStorage({ onboardingComplete: true });
      }
      
      if (setupComplete && result.shouldAutoFill && result.lastSelectedText) {
        const text = result.lastSelectedText;
        setInputText(text);
        // 直接使用从存储读取的值，避免依赖尚未更新的 state
        setLoading(true);
        setShowResult(true);
        setResult({ type: 'streaming', text: '' });
        
        aiServiceRef.current.explainTextStream(text, { language: currentLang, speed: currentSpeed }, (chunk) => {
          setResult(prev => ({
            type: 'streaming',
            text: (prev.text || '') + chunk
          }));
        }).then(html => {
          setResult({ type: 'success', html });
          // 注意：由于 explainText 也是异步的且依赖于 recordUsage/upsertCache，
          // 这里我们可能需要稍微重构或直接在这里调用相关逻辑
          recordUsage({ inputText: text, outputText: html.replace(/<[^>]+>/g, '') });
          upsertCache(text, html, currentLang, currentSpeed);
          
          setHistoryList((currentHistory) => {
            const newHistory = [
              { key: text, text: text.substring(0, 50), timestamp: new Date().toLocaleString(), language: currentLang, speed: currentSpeed },
              ...currentHistory.filter(h => h.key !== text)
            ].slice(0, 10);
            setStorage({ history: newHistory });
            return newHistory;
          });
        }).catch(error => {
          const t_local = currentLang === 'zh' ? popupZh : popupEn;
          setResult({ type: 'error', message: `${t_local.api_error_prefix}${error.message}` });
        }).finally(() => {
          setLoading(false);
          setStorage({ shouldAutoFill: false, lastSelectedText: '' });
        });
      }
    });
  }, []);

  // 语言菜单点击外部关闭
  useEffect(() => {
    if (!langMenuOpen) return;
    const handler = (e) => {
      if (langWrapRef.current && !langWrapRef.current.contains(e.target)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [langMenuOpen]);

  // ========== 提交 ==========
  const explainText = useCallback(async (rawText, overrideLang, overrideSpeed) => {
    const text = rawText.trim();
    if (!text) {
      setResult({ type: 'error', message: t.empty_input });
      setShowResult(true);
      return;
    }

    const currentLang = overrideLang || language;
    const currentSpeed = overrideSpeed || speed;

    const cached = getCache(text, currentLang, currentSpeed);
    if (cached?.explanation) {
      setResult({ type: 'success', html: cached.explanation });
      setShowResult(true);
      return;
    }

    setLoading(true);
    setShowResult(true);
    setResult({ type: 'streaming', text: '' });

    try {
      let streamedText = '';
      const html = await aiServiceRef.current.explainTextStream(text, { language: currentLang, speed: currentSpeed }, (chunk) => {
        streamedText += chunk;
        setResult({ type: 'streaming', text: streamedText });
      });
      setResult({ type: 'success', html });
      recordUsage({ inputText: text, outputText: streamedText });
      upsertCache(text, html, currentLang, currentSpeed);

      setHistoryList((currentHistory) => {
        const newHistory = [
          { key: text, text: text.substring(0, 50), timestamp: new Date().toLocaleString(), language: currentLang, speed: currentSpeed },
          ...currentHistory.filter(h => h.key !== text)
        ].slice(0, 10);
        setStorage({ history: newHistory });
        return newHistory;
      });
    } catch (error) {
      setResult({ type: 'error', message: `${t.api_error_prefix}${error.message}` });
    } finally {
      setLoading(false);
    }
  }, [language, speed, getCache, upsertCache, t]);

  const handleSubmit = useCallback(() => {
    explainText(inputText);
  }, [inputText, explainText]);

  // ========== 渲染 ==========
  if (onboardingRequired === null) {
    return <div className="popup-initializing" aria-label="Loading"></div>;
  }

  if (onboardingRequired) {
    return (
      <WelcomeFlow
        language={language}
        initialProvider={initialProvider}
        onLanguageChange={(nextLanguage) => {
          setLanguage(nextLanguage);
          setStorage({ lang: nextLanguage });
        }}
        onComplete={() => setOnboardingRequired(false)}
      />
    );
  }

  return (
    <div className="popup-container">
      {/* 标题栏 */}
      <div className="popup-header">
        <div>
          <h1 className="popup-title">{t.app_title}</h1>
        </div>
        <button className="settings-btn" onClick={() => {
          if (typeof chrome !== 'undefined' && chrome?.runtime?.openOptionsPage) {
            chrome.runtime.openOptionsPage();
          }
        }} aria-label="Settings" title="Settings">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="settings-icon">
            <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
            <path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a8.4 8.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A8.4 8.4 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.5 2.4-1a8.4 8.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a8.4 8.4 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5Zm-7.4 4a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Z" />
          </svg>
        </button>
      </div>

      {/* 输入区域 */}
      <textarea
        className="input-area"
        value={inputText}
        disabled={loading}
        onChange={e => setInputText(e.target.value)}
        placeholder={t.input_placeholder}
        rows={4}
      />

      {/* 操作栏 */}
      <div className="action-bar">
        <button className="ask-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? t.thinking : t.ask_ai}
        </button>

        {/* 语言切换 */}
        <div ref={langWrapRef} className="lang-wrap">
          <button className="lang-toggle" onClick={() => setLangMenuOpen(!langMenuOpen)}>
            {language.toUpperCase()}
          </button>
          {langMenuOpen && (
            <div className="lang-menu open">
              {['zh', 'en'].map(lang => (
                <div key={lang}
                  className={`lang-option ${language === lang ? 'active' : ''}`}
                  onClick={() => { setLanguage(lang); setLangMenuOpen(false); setStorage({ lang }); }}
                >{lang.toUpperCase()}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 速度切换 */}
      <div className="speed-bar">
        <span className="speed-label">{t.speed_label}</span>
        <div className="speed-toggle-group">
          {['fast', 'detail'].map(s => (
            <button key={s}
              className={`speed-btn ${speed === s ? 'active' : ''}`}
              onClick={() => { setSpeed(s); setStorage({ explainSpeed: s }); }}
            >{t['speed_' + s]}</button>
          ))}
        </div>
      </div>

      {/* 结果区域 */}
      {showResult && (
        <div className="result-panel">
          <div className="result-header">
            <h3 className="result-title">{t.results_title}</h3>
            <div className="result-header-right">
              <button className="result-close-btn" onClick={() => setShowResult(false)}>✕</button>
            </div>
          </div>
          <div>
            {result?.type === 'loading' && <LoadingSpinner text={t.thinking} />}
            {result?.type === 'streaming' && <ResultStreaming text={result.text || t.thinking} />}
            {result?.type === 'error' && <ResultError message={result.message} />}
            {result?.type === 'success' && <ResultSuccess html={result.html} />}
          </div>
        </div>
      )}

      {/* 历史记录 */}
      {historyList.length > 0 && (
        <div className="history-panel">
          <div className="history-header">
            <h3 className="history-title">{t.history_title}</h3>
            <button className="clear-history-btn" onClick={() => { setHistoryList([]); setStorage({ history: [] }); }}>
              {t.clear_history}
            </button>
          </div>
          {historyList.slice(0, 5).map((item, i) => (
            <HistoryItem key={i} item={item} onClick={() => {
              setInputText(item.text);
              setLanguage(item.language || 'zh');
              setSpeed(item.speed || 'fast');
              explainText(item.text, item.language || 'zh', item.speed || 'fast');
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Popup;
