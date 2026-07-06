import { useState, useCallback, useEffect, useRef } from 'react';
import '../styles.css';
import '../Stream.css';
import AIService from '../shared/apiService';
import { recordUsage } from '../shared/usageStats';
import { firstRunCopy, popupCopy } from '../locales/popup';
import { getStorage, setStorage } from '../shared/storage';
import HistoryList from './components/HistoryList';
import PopupHeader from './components/PopupHeader';
import ResultPanel from './components/ResultPanel';
import TextInputPanel from './components/TextInputPanel';

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

function LanguageWelcome({ language, onLanguageChange }) {
  const [opening, setOpening] = useState(false);
  const t = firstRunCopy[language];

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
  const [showAllHistory, setShowAllHistory] = useState(false);
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
  const t = popupCopy[language];

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

  const handleOpenSettings = () => {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  };

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    setLangMenuOpen(false);
    setStorage({ lang: nextLanguage });
  };

  const handleSpeedChange = (nextSpeed) => {
    setSpeed(nextSpeed);
    setStorage({ explainSpeed: nextSpeed });
  };

  const handleClearHistory = () => {
    setHistoryList([]);
    setShowAllHistory(false);
    setStorage({ history: [] });
  };

  const handleHistorySelect = (item) => {
    const itemLanguage = item.language || 'zh';
    const itemSpeed = item.speed || 'fast';
    setInputText(item.text);
    setLanguage(itemLanguage);
    setSpeed(itemSpeed);
    explainText(item.text, itemLanguage, itemSpeed);
  };

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
      <PopupHeader
        copy={t}
        aiMode={aiMode}
        freeRemaining={freeRemaining}
        onOpenSettings={handleOpenSettings}
      />
      <TextInputPanel
        copy={t}
        inputText={inputText}
        loading={loading}
        language={language}
        speed={speed}
        langMenuOpen={langMenuOpen}
        langWrapRef={langWrapRef}
        onInputChange={(event) => setInputText(event.target.value)}
        onSubmit={handleSubmit}
        onToggleLanguageMenu={() => setLangMenuOpen(!langMenuOpen)}
        onLanguageChange={handleLanguageChange}
        onSpeedChange={handleSpeedChange}
      />
      <ResultPanel
        copy={t}
        result={result}
        visible={showResult}
        onClose={() => setShowResult(false)}
      />
      <HistoryList
        copy={t}
        historyList={historyList}
        showAllHistory={showAllHistory}
        onClear={handleClearHistory}
        onSelect={handleHistorySelect}
        onToggleShowAll={() => setShowAllHistory((current) => !current)}
      />
    </div>
  );
}

export default Popup;
