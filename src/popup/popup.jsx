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
  retry: '重试',
  built_in: '内置 AI',
  byok: '自带 Key',
  free_left: '今日剩余 {count} 次',
  quota_exceeded: '你已用完今天的 50 次免费解释。请明天再来，或在高级设置中添加自己的 API Key。',
  text_too_long: '免费模式下这段文字太长了。请缩短到 1000 字以内，或使用自己的 API Key。',
  rate_limited: '请求有点频繁，请稍等片刻再试。',
  key_required: '请先在高级设置中添加自己的 API Key，或切换回内置 AI。',
  generic_error: '解释暂时失败，请稍后再试。'
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
  retry: 'Try Again',
  built_in: 'Built-in AI',
  byok: 'Your API key',
  free_left: '{count} free today',
  quota_exceeded: 'You’ve used today’s 50 free explanations. Come back tomorrow or add your own API key.',
  text_too_long: 'This selection is too long for the free plan. Try a shorter passage or use your own API key.',
  rate_limited: 'That was a little too fast. Please wait a moment and try again.',
  key_required: 'Add your API key in Advanced settings, or switch back to Built-in AI.',
  generic_error: 'Explanation failed. Please try again in a moment.'
};

const firstRunZh = {
  eyebrow: '欢迎使用 Explain This',
  step: '第 1 步，共 4 步',
  continue: '继续前往设置',
  opening: '正在打开设置…',
  languageTitle: '选择你的使用语言',
  languageBody: '这会决定界面和 AI 回答的默认语言，之后仍可随时切换。',
  chinese: '中文',
  chineseHint: '使用中文界面和回答',
  english: 'English',
  englishHint: 'Use the app and AI in English'
};

const firstRunEn = {
  eyebrow: 'Welcome to Explain This',
  step: 'Step 1 of 4',
  continue: 'Continue to Settings',
  opening: 'Opening Settings…',
  languageTitle: 'Choose your language',
  languageBody: 'This sets the default language for the interface and AI responses. You can change it later.',
  chinese: '中文',
  chineseHint: '使用中文界面和回答',
  english: 'English',
  englishHint: 'Use the app and AI in English'
};

async function openOnboardingSettings() {
  if (typeof chrome !== 'undefined' && chrome?.runtime?.openOptionsPage) {
    const result = chrome.runtime.openOptionsPage();
    if (result?.then) await result;
    window.close();
    return;
  }
  window.location.href = '/settings.html?onboarding=1';
}

// ========== 简单内存缓存 ==========
function useSimpleCache(enabled) {
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
    if (!enabled) return null;
    const key = normalizeKey(text, language, speed);
    return cacheRef.current[key] || null;
  }, [enabled]);

  const upsertCache = useCallback((text, explanation, language, speed) => {
    if (!enabled) return;
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
  }, [enabled]);

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

function LanguageWelcome({ language, onLanguageChange }) {
  const [opening, setOpening] = useState(false);
  const t = language === 'zh' ? firstRunZh : firstRunEn;

  const handleContinue = async () => {
    setOpening(true);
    await setStorage({ lang: language, onboardingStarted: true });
    await openOnboardingSettings();
    setOpening(false);
  };

  return (
    <main className="welcome-container step-1">
      <div className="welcome-topline">
        <span className="welcome-brand">{t.eyebrow}</span>
        <span className="welcome-step">{t.step}</span>
      </div>

      <div className="welcome-progress" aria-hidden="true">
        <span className="active"></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

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
          <button className="welcome-primary" onClick={handleContinue} disabled={opening}>
            {opening ? t.opening : t.continue}
          </button>
        </div>
      </section>
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
  const [pendingSelection, setPendingSelection] = useState(null);
  const [saveRecentExplanations, setSaveRecentExplanations] = useState(true);
  const [aiMode, setAiMode] = useState('builtIn');
  const [freeRemaining, setFreeRemaining] = useState(50);

  const langWrapRef = useRef(null);
  const processedSelectionIdsRef = useRef(new Set());
  const aiServiceRef = useRef(new AIService());
  const { getCache, upsertCache } = useSimpleCache(saveRecentExplanations);
  const t = language === 'zh' ? popupZh : popupEn;

  // 初始化
  useEffect(() => {
    getStorage([
      'lang',
      'explainSpeed',
      'history',
      'pendingExplanation',
      'lastSelectedText',
      'shouldAutoFill',
      'onboardingComplete',
      'onboardingStarted',
      'apiKey',
      'geminiApiKey',
      'openaiApiKey',
      'aiMode',
      'saveRecentExplanations',
      'freeUsage'
    ]).then(result => {
      const hasSavedKey = [result.apiKey, result.geminiApiKey, result.openaiApiKey]
        .some(key => String(key || '').trim());
      const setupComplete = result.onboardingComplete === true || hasSavedKey;
      const nextMode = result.aiMode || (hasSavedKey ? 'byok' : 'builtIn');
      const shouldSaveRecent = result.saveRecentExplanations !== false;
      
      if (result.lang) {
        setLanguage(result.lang);
      }
      if (result.explainSpeed) {
        setSpeed(result.explainSpeed);
      }
      setAiMode(nextMode);
      setSaveRecentExplanations(shouldSaveRecent);
      if (shouldSaveRecent && result.history) setHistoryList(result.history);
      if (result.freeUsage?.date === new Date().toISOString().slice(0, 10)) {
        setFreeRemaining(Number(result.freeUsage.remaining) || 0);
      }

      if (hasSavedKey && result.onboardingComplete !== true) {
        setStorage({ onboardingComplete: true, aiMode: 'byok' });
      }

      if (!setupComplete && result.onboardingStarted) {
        openOnboardingSettings();
        return;
      }
      setOnboardingRequired(!setupComplete);

      if (result.pendingExplanation?.text) {
        setPendingSelection(result.pendingExplanation);
      } else if (result.shouldAutoFill && result.lastSelectedText) {
        setPendingSelection({
          id: `legacy:${result.lastSelectedText}`,
          text: result.lastSelectedText
        });
      }
    });
  }, []);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) return;
    chrome.runtime.sendMessage({ action: 'activateCurrentTab' }, () => {
      void chrome.runtime.lastError;
    });
  }, []);

  // popup window 被复用时也要接收新的划词请求
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) return undefined;
    const handleStorageChange = (changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes.aiMode?.newValue) setAiMode(changes.aiMode.newValue);
      if (changes.saveRecentExplanations) {
        const enabled = changes.saveRecentExplanations.newValue !== false;
        setSaveRecentExplanations(enabled);
        if (!enabled) setHistoryList([]);
      }
      if (changes.freeUsage?.newValue) {
        setFreeRemaining(Number(changes.freeUsage.newValue.remaining) || 0);
      }
      const request = changes.pendingExplanation?.newValue;
      if (request?.text) {
        setPendingSelection(request);
        return;
      }
      if (changes.shouldAutoFill?.newValue === true) {
        getStorage(['lastSelectedText']).then(result => {
          if (!result.lastSelectedText) return;
          setPendingSelection({
            id: `legacy:${result.lastSelectedText}`,
            text: result.lastSelectedText
          });
        });
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
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

      if (saveRecentExplanations) {
        setHistoryList((currentHistory) => {
          const newHistory = [
            { key: text, text: text.substring(0, 50), timestamp: new Date().toLocaleString(), language: currentLang, speed: currentSpeed },
            ...currentHistory.filter(h => h.key !== text)
          ].slice(0, 10);
          setStorage({ history: newHistory });
          return newHistory;
        });
      }
    } catch (error) {
      const errorMessages = {
        QUOTA_EXCEEDED: t.quota_exceeded,
        TEXT_TOO_LONG: t.text_too_long,
        RATE_LIMITED: t.rate_limited,
        COOLDOWN_ACTIVE: t.rate_limited,
        BYOK_KEY_REQUIRED: t.key_required,
      };
      setResult({ type: 'error', message: errorMessages[error.code] || t.generic_error });
    } finally {
      setLoading(false);
    }
  }, [language, speed, getCache, upsertCache, saveRecentExplanations, t]);

  const handleSubmit = useCallback(() => {
    explainText(inputText);
  }, [inputText, explainText]);

  // 消费一次划词请求；先清除持久化标记，避免 popup 重开后重复解释
  useEffect(() => {
    if (onboardingRequired !== false || !pendingSelection?.text) return;
    const text = String(pendingSelection.text).trim();
    if (!text) return;

    const requestId = pendingSelection.id || `legacy:${text}`;
    if (processedSelectionIdsRef.current.has(requestId)) return;
    processedSelectionIdsRef.current.add(requestId);

    setPendingSelection(null);
    setInputText(text);
    setStorage({
      pendingExplanation: null,
      shouldAutoFill: false,
      lastSelectedText: ''
    });
    explainText(text);
  }, [onboardingRequired, pendingSelection, explainText]);

  // ========== 渲染 ==========
  if (onboardingRequired === null) {
    return <div className="popup-initializing" aria-label="Loading"></div>;
  }

  if (onboardingRequired) {
    return (
      <LanguageWelcome
        language={language}
        onLanguageChange={(nextLanguage) => {
          setLanguage(nextLanguage);
          setStorage({ lang: nextLanguage });
        }}
      />
    );
  }

  return (
    <div className="popup-container">
      {/* 标题栏 */}
      <div className="popup-header">
        <div>
          <h1 className="popup-title">{t.app_title}</h1>
          <div className="ai-mode-badge">
            <span>{aiMode === 'builtIn' ? t.built_in : t.byok}</span>
            {aiMode === 'builtIn' && (
              <small>{t.free_left.replace('{count}', freeRemaining)}</small>
            )}
          </div>
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
