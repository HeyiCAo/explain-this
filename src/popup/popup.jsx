// Popup.jsx - 兼容 Chrome 扩展和本地预览
import React, { useState, useCallback, useEffect, useRef } from 'react';

// ========== 环境适配 ==========
const isExtension = typeof chrome !== 'undefined' && chrome?.storage;

if (!isExtension) {
  // Mock Chrome API
  const mockStorage = {};
  window.chrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          const result = {};
          (Array.isArray(keys) ? keys : [keys]).forEach(k => {
            result[k] = mockStorage[k];
          });
          setTimeout(() => cb?.(result), 0);
        },
        set: (values, cb) => {
          Object.assign(mockStorage, values);
          setTimeout(() => cb?.(), 0);
        },
        onChanged: { addListener() {}, removeListener() {} }
      }
    },
    runtime: {
      onMessage: { addListener() {}, removeListener() {} }
    },
    tabs: {
      query: (_, cb) => cb([{ id: 1 }]),
      create: ({ url }) => window.open(url, '_blank'),
      sendMessage: (_, __, cb) => cb?.({ text: '这是模拟的选中文本' })
    }
  };
}

// ========== 工具函数 ==========
const getStorage = (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve));
const setStorage = (values) => new Promise(resolve => chrome.storage.local.set(values, resolve));

// ========== 简单内存缓存（替代 RBTree，本地预览也能用）==========
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
    // 同时存到 storage
    getStorage(['explainCache']).then(result => {
      const list = result.explainCache || [];
      const newList = [cacheRef.current[key], ...list.filter(i => i.key !== key)].slice(0, 100);
      setStorage({ explainCache: newList });
    });
  }, []);

  return { getCache, upsertCache, normalizeKey };
}

// ========== 国际化 ==========
function useI18n(language) {
  const dicts = {
    zh: {
      app_title: 'Explain This',
      app_subtitle: '解释选中的内容',
      input_placeholder: "粘贴或输入你不懂的内容...\n例如：'内卷是什么意思？'\n      'Python中的装饰器怎么理解？'\n      '这个历史典故有什么背景？'",
      ask_ai: '✨ Ask AI',
      speed_label: '速度',
      speed_fast: '快',
      speed_detail: '详',
      results_title: '结果',
      quick_hint: 'Ctrl+Enter - 快速解释',
      thinking: '思考中...',
      history_title: '最近记录',
      clear_history: '清空',
      empty_input: '请输入要解释的内容'
    },
    en: {
      app_title: 'Explain This',
      app_subtitle: 'Explain highlighted content',
      input_placeholder: "Paste or type what you don't understand...",
      ask_ai: '✨ Ask AI',
      speed_label: 'Speed',
      speed_fast: 'Fast',
      speed_detail: 'Detail',
      results_title: 'Results',
      quick_hint: 'Ctrl+Enter - Quick Explain',
      thinking: 'Thinking...',
      history_title: 'Recent',
      clear_history: 'Clear',
      empty_input: 'Please enter text to explain'
    }
  };

  const dict = dicts[language] || dicts.zh;
  const t = (key) => dict[key] || key;

  return { t, dict };
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
  const { getCache, upsertCache } = useSimpleCache();
  const { t, dict } = useI18n(language);

  // 初始化
  useEffect(() => {
    getStorage(['explainLang', 'explainSpeed', 'history']).then(result => {
      if (result.explainLang) setLanguage(result.explainLang);
      if (result.explainSpeed) setSpeed(result.explainSpeed);
      if (result.history) setHistoryList(result.history);
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
  const handleSubmit = useCallback(async () => {
    const text = inputText.trim();
    if (!text) {
      setResult({ type: 'error', message: t('empty_input') });
      setShowResult(true);
      return;
    }

    // 查缓存
    const cached = getCache(text, language, speed);
    if (cached?.explanation) {
      setResult({ type: 'success', html: cached.explanation });
      setShowResult(true);
      return;
    }

    // 模拟 API 调用（本地预览）
    setLoading(true);
    setShowResult(true);
    setResult({ type: 'loading' });

    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 模拟返回结果
    const mockHtml = `
      <div style="color:#333;line-height:1.6;padding:15px;">
        <h4 style="color:#4da3ff;">📝 您查询的是：</h4>
        <p style="background:#f5f5f5;padding:10px;border-radius:5px;">${text}</p>
        <h4 style="color:#4da3ff;margin-top:20px;">🤖 解释：</h4>
        <p>这是对 "${text.substring(0, 30)}" 的模拟解释。</p>
        <p style="color:#888;font-size:13px;">（本地预览模式，连接真实 API 后会返回实际结果）</p>
      </div>
    `;

    setResult({ type: 'success', html: mockHtml });
    upsertCache(text, mockHtml, language, speed);
    setLoading(false);

    // 更新历史
    const newHistory = [
      { key: text, text: text.substring(0, 50), timestamp: new Date().toLocaleString(), language, speed },
      ...historyList.filter(h => h.key !== text)
    ].slice(0, 10);
    setHistoryList(newHistory);
    setStorage({ history: newHistory });

  }, [inputText, language, speed, historyList, getCache, upsertCache, t]);

  // ========== 渲染 ==========
  return (
    <div className="container" style={{
      width: isExtension ? 'auto' : '400px',
      margin: isExtension ? 0 : '20px auto',
      fontFamily: 'system-ui, sans-serif',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: isExtension ? 'none' : '0 4px 20px rgba(0,0,0,0.1)',
      padding: '20px'
    }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px' }}>{dict.app_title}</h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.7 }}>{dict.app_subtitle}</p>
        </div>
        <button style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}
          onClick={() => {
            if (isExtension) chrome.tabs.create({ url: 'settings.html' });
            else alert('设置页面（仅在 Chrome 扩展中可用）');
          }}
        >⚙️</button>
      </div>

      {/* 输入区域 */}
      <textarea
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        onKeyDown={e => {
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={dict.input_placeholder}
        rows={4}
        style={{
          width: '100%', padding: '12px', borderRadius: '8px',
          border: '1px solid #ddd', fontSize: '14px',
          resize: 'vertical', boxSizing: 'border-box',
          fontFamily: 'inherit'
        }}
      />

      {/* 操作栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
        <button
          onClick={handleSubmit}
          style={{
            padding: '8px 20px', borderRadius: '8px',
            border: 'none', background: '#4da3ff', color: '#fff',
            fontSize: '14px', cursor: 'pointer', fontWeight: '500'
          }}
        >
          {dict.ask_ai}
        </button>

        {/* 语言切换 */}
        <div ref={langWrapRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setLangMenuOpen(!langMenuOpen)}
            style={{
              padding: '8px 12px', borderRadius: '8px',
              border: '1px solid #ddd', background: '#fff',
              cursor: 'pointer', fontSize: '14px'
            }}
          >
            {language.toUpperCase()}
          </button>
          {langMenuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '4px',
              background: '#fff', border: '1px solid #ddd', borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden'
            }}>
              {['zh', 'en'].map(lang => (
                <div key={lang}
                  onClick={() => { setLanguage(lang); setLangMenuOpen(false); setStorage({ explainLang: lang }); }}
                  style={{
                    padding: '8px 20px', cursor: 'pointer',
                    background: language === lang ? '#e8f4ff' : 'transparent',
                    fontSize: '14px'
                  }}
                >{lang.toUpperCase()}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 速度切换 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
        <span style={{ fontSize: '13px', opacity: 0.7 }}>{dict.speed_label}</span>
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
          {['fast', 'detail'].map(s => (
            <button key={s}
              onClick={() => { setSpeed(s); setStorage({ explainSpeed: s }); }}
              style={{
                padding: '6px 16px', border: 'none',
                background: speed === s ? '#4da3ff' : '#fff',
                color: speed === s ? '#fff' : '#333',
                cursor: 'pointer', fontSize: '13px'
              }}
            >{dict['speed_' + s]}</button>
          ))}
        </div>
      </div>

      {/* 结果区域 */}
      {showResult && (
        <div style={{ marginTop: '16px', border: '1px solid #eee', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>{dict.results_title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', opacity: 0.5 }}>{dict.quick_hint}</span>
              <button onClick={() => setShowResult(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
              >✕</button>
            </div>
          </div>
          <div>
            {result?.type === 'loading' && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{
                  width: '30px', height: '30px', border: '3px solid #eee',
                  borderTop: '3px solid #4da3ff', borderRadius: '50%',
                  animation: 'spin 1s linear infinite', margin: '0 auto'
                }}></div>
                <p style={{ marginTop: '10px', opacity: 0.7 }}>{dict.thinking}</p>
              </div>
            )}
            {result?.type === 'error' && (
              <div style={{ background: '#fff3cd', color: '#856404', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
                {result.message}
              </div>
            )}
            {result?.type === 'success' && (
              <div dangerouslySetInnerHTML={{ __html: result.html }} />
            )}
          </div>
        </div>
      )}

      {/* 历史记录 */}
      {historyList.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>{dict.history_title}</h3>
            <button onClick={() => { setHistoryList([]); setStorage({ history: [] }); }}
              style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '13px' }}
            >{dict.clear_history}</button>
          </div>
          {historyList.slice(0, 5).map((item, i) => (
            <div key={i}
              onClick={() => {
                setInputText(item.text);
                setLanguage(item.language || 'zh');
                setSpeed(item.speed || 'fast');
              }}
              style={{
                padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '13px', marginBottom: '4px',
                background: '#f9f9f9', border: '1px solid #eee'
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.text}
              </span>
              <span style={{ marginLeft: '10px', opacity: 0.5, fontSize: '11px' }}>
                {(item.language || 'zh').toUpperCase()} · {item.timestamp}
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Popup;