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

// ========== 简单内存缓存 ==========
function useSimpleCache() {
  const cacheRef = useRef({});

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

// ========== 主组件 ==========
function Popup() {
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState('zh');
  const [speed, setSpeed] = useState('fast');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const langWrapRef = useRef(null);
  const aiServiceRef = useRef(new AIService());
  const { getCache, upsertCache } = useSimpleCache();
  const t = language === 'zh' ? popupZh : popupEn;

  // 初始化
  useEffect(() => {
    getStorage(['explainLang', 'explainSpeed', 'history', 'lastSelectedText', 'shouldAutoFill']).then(result => {
      if (result.explainLang) setLanguage(result.explainLang);
      if (result.explainSpeed) setSpeed(result.explainSpeed);
      if (result.history) setHistoryList(result.history);
      if (result.shouldAutoFill && result.lastSelectedText) {
        setInputText(result.lastSelectedText);
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
  const explainText = useCallback(async (rawText) => {
    const text = rawText.trim();
    if (!text) {
      setResult({ type: 'error', message: t.empty_input });
      setShowResult(true);
      return;
    }

    const cached = getCache(text, language, speed);
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
      const html = await aiServiceRef.current.explainTextStream(text, { language, speed }, (chunk) => {
        streamedText += chunk;
        setResult({ type: 'streaming', text: streamedText });
      });
      setResult({ type: 'success', html });
      recordUsage({ inputText: text, outputText: streamedText });
      upsertCache(text, html, language, speed);

      setHistoryList((currentHistory) => {
        const newHistory = [
          { key: text, text: text.substring(0, 50), timestamp: new Date().toLocaleString(), language, speed },
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

  useEffect(() => {
    getStorage(['shouldAutoFill', 'lastSelectedText']).then(result => {
      if (result.shouldAutoFill && result.lastSelectedText) {
        setInputText(result.lastSelectedText);
        explainText(result.lastSelectedText);
        setStorage({ shouldAutoFill: false, lastSelectedText: '' });
      }
    });
  }, [explainText]);

  const handleSubmit = useCallback(() => {
    explainText(inputText);
  }, [inputText, explainText]);

  // ========== 渲染 ==========
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
                  onClick={() => { setLanguage(lang); setLangMenuOpen(false); setStorage({ explainLang: lang }); }}
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
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Popup;
