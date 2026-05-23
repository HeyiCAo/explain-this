import { useState, useEffect } from 'react'
import '../settingStyle.css'
import { formatTokenCount, getUsageStats, normalizeUsageStats, remainingTokens } from '../shared/usageStats'

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

const settingsZh = {
      settings: '设置',
      apiConfig: 'API 配置',
      provider: '服务商：',
      deepseek: 'DeepSeek',
      gemini: 'Gemini',
      openai: 'OpenAI',
      deepseekGuide: 'DeepSeek API Key 获取指南',
      deepseekStep1: '1. 打开 DeepSeek 开放平台并登录/注册',
      deepseekStep2: '2. 进入 API Keys 页面创建新密钥',
      deepseekStep3: '3. 将密钥粘贴到下方',
      geminiGuide: 'Gemini API Key 获取指南',
      geminiStep1: '1. 打开 Google AI Studio 的 API key 页面',
      geminiStep2: '2. 将密钥粘贴到下方',
      openaiGuide: 'OpenAI API Key 获取指南',
      openaiStep1: '1. 打开 OpenAI Platform 的 API keys 页面',
      openaiStep2: '2. 创建新密钥并粘贴到下方',
      dataNotice: '数据说明',
      dataNoticeContent: '选中的文本将发送给您选择的 AI 服务商以生成解释。详见我们的隐私政策。',
      privacyPolicy: '隐私政策',
      openDeepseekPlatform: '打开 DeepSeek 平台',
      openDeepseekDocs: '查看 DeepSeek API 文档',
      openGeminiKeys: '打开 Gemini API Key 页面',
      openOpenAIKeys: '打开 OpenAI API Key 页面',
      openPrivacyPolicy: '查看隐私政策',
      apiKeyLabel: 'API Key：',
      apiKeyPlaceholder: 'sk-...',
      geminiKeyLabel: 'Gemini API Key：',
      geminiKeyPlaceholder: 'AIza...',
      openaiKeyLabel: 'OpenAI API Key：',
      openaiKeyPlaceholder: 'sk-...',
      saveKey: '保存密钥',
      testConnection: '测试连接',
      usageStats: '使用统计',
      todayUsage: '今日使用：',
      totalUsage: '累计使用：',
      creditRemaining: '估算剩余额度：',
      usageStatsNote: '按本地请求记录估算 token；真实账单请以服务商控制台为准。',
      hotkeySettings: '快捷键与操作方式',
      explainSelected: '解释选中内容：',
      close: '关闭',
      status_enter_key: '请输入API密钥。详情请查看设置页面。',
      status_invalid_key: '密钥格式无效',
      status_testing: '正在测试连接...',
      status_success: '连接成功！',
      status_invalid_retry: '密钥无效，请重试',
      status_conn_failed: '连接失败，请检查网络',
      mouseClick: '点击弹窗',
      mouseClickStep: '选词并点击后，AI搜索会自动开始。 '
    };
const settingsEn = {
      settings: 'Settings',
      apiConfig: 'API Configurations',
      provider: 'Provider:',
      deepseek: 'DeepSeek',
      gemini: 'Gemini',
      openai: 'OpenAI',
      deepseekGuide: 'DeepSeek API Key Required',
      deepseekStep1: '1. Open the DeepSeek platform and sign in or register',
      deepseekStep2: '2. Go to API Keys and create a new secret key',
      deepseekStep3: '3. Paste the key below',
      geminiGuide: 'Gemini API Key Required',
      geminiStep1: '1. Open the Google AI Studio API key page',
      geminiStep2: '2. Paste the key below',
      openaiGuide: 'OpenAI API Key Required',
      openaiStep1: '1. Open the OpenAI Platform API keys page',
      openaiStep2: '2. Create a new secret key and paste it below',
      dataNotice: 'Data Notice',
      dataNoticeContent: 'Selected text will be sent to your chosen AI provider to generate explanations. See our Privacy Policy.',
      privacyPolicy: 'Privacy Policy',
      openDeepseekPlatform: 'Open DeepSeek Platform',
      openDeepseekDocs: 'View DeepSeek API Docs',
      openGeminiKeys: 'Open Gemini API Key Page',
      openOpenAIKeys: 'Open OpenAI API Key Page',
      openPrivacyPolicy: 'View Privacy Policy',
      apiKeyLabel: 'API Key:',
      apiKeyPlaceholder: 'sk-...',
      geminiKeyLabel: 'Gemini API Key:',
      geminiKeyPlaceholder: 'AIza...',
      openaiKeyLabel: 'OpenAI API Key:',
      openaiKeyPlaceholder: 'sk-...',
      saveKey: 'Save Key',
      testConnection: 'Test Connection',
      usageStats: 'Usage Statistics',
      todayUsage: 'Today:',
      totalUsage: 'Total:',
      creditRemaining: 'Estimated remaining:',
      usageStatsNote: 'Estimated from local request records. Provider dashboards remain the source of truth.',
      hotkeySettings: 'Hotkeys and Manuals',
      explainSelected: 'Explain Selected:',
      close: 'Close',
      status_enter_key: 'Please enter API key to begin searching. Visit settings page for more detail.',
      status_invalid_key: 'Invalid API key format',
      status_testing: 'Testing connection...',
      status_success: 'Success!',
      status_invalid_retry: 'Invalid API key. Try again.',
      status_conn_failed: 'Connection failed. Check network.',
      mouseClick: 'Click',
      mouseClickStep: 'When clicking on the popup after text selection, search will automatically begin.'
    };

function InfoBox({boxId, title, children, style}) {
    return (
        <div className="info-box" id={boxId} style={style}>
            <strong>{title}</strong>
            {children}
        </div>
    );
}

function StatItem({id, title, children}) {
    return(
        <div className="stat-item" id={id}>
            <span className="stat-label">{title}</span>
            <span className="stat-value">{children}</span>
        </div>
    );
}

function Section({id, title, children}) {
    return(
        <div className="section" id = {id}>
                  <div className="section-title">
                    <span></span>
                    <span>{title}</span>
                  </div>
        {children}
        </div>
    );
}

function isMacPlatform() {
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function LinkButton({ href, children }) {
    return (
        <a className="guide-link" href={href} target="_blank" rel="noreferrer">
            {children}
        </a>
    );
}

function SettingsPage() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [provider, setProvider] = useState('deepseek');
    const [lang, setLang] = useState('zh');
    const [status, setStatus] = useState({ message: '', type: '' });
    const [usageStats, setUsageStats] = useState(normalizeUsageStats());
    const [apiKey, setApiKey] = useState('');
    const t = lang === 'zh' ? settingsZh : settingsEn;
    const shortcutModifier = isMacPlatform() ? 'Cmd' : 'Ctrl';
    const privacyUrl = typeof chrome !== 'undefined' && chrome?.runtime?.getURL
        ? chrome.runtime.getURL('privacy-policy.html')
        : '/privacy-policy.html';

    useEffect(() => {
      getStorage(["apiKey", "geminiApiKey", "openaiApiKey", "provider", "lang"]).then((result) => {
        const savedProvider = result.provider || 'openai';
        setProvider(savedProvider);
        if (savedProvider === 'gemini') {
            setApiKey(result.geminiApiKey || '');
        } else if (savedProvider === 'deepseek') {
            setApiKey(result.openaiApiKey || '');
        } else {
            setApiKey(result.apiKey || '');
        }
        if (result.lang) setLang(result.lang);
      });
    }, []);

    useEffect(() => {
        getUsageStats().then(setUsageStats);
        if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) return undefined;
        const handleStorageChange = (changes, areaName) => {
            if (areaName !== 'local' || !changes.usageStats) return;
            setUsageStats(normalizeUsageStats(changes.usageStats.newValue));
        };
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    useEffect(() => {
        setStorage({ lang });
    }, [lang]);

    function handleProviderChange(nextProvider) {
        setMenuOpen(false);
        setProvider(nextProvider);
        setStorage({ provider: nextProvider });
        getStorage(["apiKey", "geminiApiKey", "openaiApiKey"]).then((result) => {
            if (nextProvider === 'gemini') {
                setApiKey(result.geminiApiKey || '');
            } else if (nextProvider === 'openai') {
                setApiKey(result.openaiApiKey || '');
            } else {
                setApiKey(result.apiKey || '');
            }
        });
    }

    function handleClose() {
        if (typeof chrome !== 'undefined' && chrome?.tabs?.getCurrent && chrome?.tabs?.remove) {
            chrome.tabs.getCurrent((tab) => {
                if (tab?.id) {
                    chrome.tabs.remove(tab.id);
                } else {
                    window.close();
                }
            });
            return;
        }
        window.close();
    }

    function handleSaveKey() {
        if (!apiKey.trim()) {
            setStatus({ message: t.status_enter_key, type: 'error' });
            return;
        }
        if (provider === 'deepseek' && !apiKey.startsWith('sk-')) {
            setStatus({ message: t.status_invalid_key, type: 'error' });
            return;
        }
        if (provider === 'gemini' && !apiKey.startsWith('AIza')) {
            setStatus({ message: t.status_invalid_key, type: 'error' });
            return;
        }
        if (provider === 'openai' && !apiKey.startsWith('sk-')) {
            setStatus({ message: t.status_invalid_key, type: 'error' });
            return;
        }
        
        let keyPayload = {};
        if (provider === 'gemini') {
            keyPayload = { provider, geminiApiKey: apiKey };
        } else if (provider === 'openai') {
            keyPayload = { provider, openaiApiKey: apiKey };
        } else {
            keyPayload = { provider, apiKey: apiKey };
        }
        
        setStorage(keyPayload);
        setStatus({ message: t.status_success, type: 'success' });
    }

    async function handleTestConnection() {
        if (provider === 'deepseek') {
            if (!apiKey.startsWith('sk-')) {
                setStatus({ message: t.status_enter_key, type: 'error' });
                return;
            }
            setStatus({ message: t.status_testing, type: 'info' });
            try {
                const response = await fetch('https://api.deepseek.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (response.ok) {
                    setStatus({ message: t.status_success, type: 'success' });
                } else {
                    setStatus({ message: t.status_invalid_key, type: 'error' });
                }
            } catch {
                setStatus({ message: t.status_invalid_retry, type: 'error' });
            }
        } else if (provider === 'gemini') {
            if (!apiKey.startsWith('AIza')) {
                setStatus({ message: t.status_enter_key, type: 'error' });
                return;
            }
            setStatus({ message: t.status_testing, type: 'info' });
            try {
                const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                    headers: { 'x-goog-api-key': apiKey }
                });
                if (response.ok) {
                    setStatus({ message: t.status_success, type: 'success' });
                } else {
                    setStatus({ message: t.status_invalid_key, type: 'error' });
                }
            } catch {
                setStatus({ message: t.status_invalid_retry, type: 'error' });
            }
        } else if (provider === 'openai') {
            if (!apiKey.startsWith('sk-')) {
                setStatus({ message: t.status_enter_key, type: 'error' });
                return;
            }
            setStatus({ message: t.status_testing, type: 'info' });
            try {
                const response = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (response.ok) {
                    setStatus({ message: t.status_success, type: 'success' });
                } else {
                    setStatus({ message: t.status_invalid_key, type: 'error' });
                }
            } catch {
                setStatus({ message: t.status_invalid_retry, type: 'error' });
            }
        }
    }

    return (
      <div>
        <div className="top-bar">
          <h1>
            <span>{t.settings}</span>
          </h1>
          <div className="top-actions">
            <span className="lang-switch">
              <button type="button" onClick={() => setLang('zh')}
                  className={lang === 'zh' ? 'active' : ''}>中</button>
              <button type="button" onClick={() => setLang('en')}
                  className={lang === 'en' ? 'active' : ''}>EN</button>
            </span>
            <button className="close-btn" onClick={handleClose}>{t.close}</button>
          </div>
        </div>

        <div className="section-grid">
          <Section id="apiConfig" title={t.apiConfig}>
            <label htmlFor="providerToggle">{t.provider}</label>
            <div className="provider-wrap">
              <button className="provider-toggle"
                type="button" aria-haspopup="listbox"
                onClick={() => setMenuOpen(!menuOpen)}>
                {provider === 'deepseek' ? "DeepSeek" : (provider === 'gemini' ? "Gemini" : "OpenAI")}
                <span>▾</span>
              </button>
              <div className={`provider-menu${menuOpen ? ' open' : ''}`} role="listbox">
                <div className="provider-item" role="option"
                  onClick={() => handleProviderChange('deepseek')}>DeepSeek</div>
                <div className="provider-item" role="option"
                  onClick={() => handleProviderChange('gemini')}>Gemini</div>
                <div className="provider-item" role="option"
                  onClick={() => handleProviderChange('openai')}>OpenAI</div>
              </div>
            </div>

            <InfoBox title={t.deepseekGuide}
              style={{ display: provider === "deepseek" ? 'block' : 'none' }}>
              <p style={{ margin: '10px 0 0 0' }}>
                {t.deepseekStep1}<br />
                {t.deepseekStep2}<br />
                {t.deepseekStep3}<br />
              </p>
              <div className="guide-links">
                <LinkButton href="https://platform.deepseek.com/">{t.openDeepseekPlatform}</LinkButton>
                <LinkButton href="https://api-docs.deepseek.com/">{t.openDeepseekDocs}</LinkButton>
              </div>
            </InfoBox>

            <InfoBox title={t.geminiGuide}
              style={{ display: provider === "gemini" ? 'block' : 'none' }}>
              <p style={{ margin: '10px 0 0 0' }}>
                {t.geminiStep1}<br />
                {t.geminiStep2}<br />
              </p>
              <div className="guide-links">
                <LinkButton href="https://aistudio.google.com/app/apikey">{t.openGeminiKeys}</LinkButton>
              </div>
            </InfoBox>

            <InfoBox title={t.openaiGuide}
              style={{ display: provider === "openai" ? 'block' : 'none' }}>
              <p style={{ margin: '10px 0 0 0' }}>
                {t.openaiStep1}<br />
                {t.openaiStep2}<br />
              </p>
              <div className="guide-links">
                <LinkButton href="https://platform.openai.com/api-keys">{t.openOpenAIKeys}</LinkButton>
              </div>
            </InfoBox>

            <InfoBox title={t.dataNotice}>
              <p style={{ margin: '8px 0 0 0' }}>
                {t.dataNoticeContent}
              </p>
              <div className="guide-links">
                <LinkButton href={privacyUrl}>{t.openPrivacyPolicy}</LinkButton>
              </div>
            </InfoBox>

            <label style={{ display: provider === "deepseek" ? 'block' : 'none' }}>{t.apiKeyLabel}</label>
            <input type="password" placeholder="sk-..."
              value={apiKey}
              style={{ display: provider === "deepseek" ? 'block' : 'none' }}
              onChange={(e) => setApiKey(e.target.value)}/>

            <label style={{ display: provider === "gemini" ? 'block' : 'none' }}>{t.geminiKeyLabel}</label>
            <input type="password" placeholder="AIza..."
              value={apiKey}
              style={{ display: provider === "gemini" ? 'block' : 'none' }}
              onChange={(e) => setApiKey(e.target.value)}/>

            <label style={{ display: provider === "openai" ? 'block' : 'none' }}>{t.openaiKeyLabel}</label>
            <input type="password" placeholder="sk-..."
              value={apiKey}
              style={{ display: provider === "openai" ? 'block' : 'none' }}
              onChange={(e) => setApiKey(e.target.value)}/>

            <div className="button-group">
              <button className="primary-btn" onClick={handleSaveKey}>{t.saveKey}</button>
              <button className="secondary-btn"
              onClick={handleTestConnection}>{t.testConnection}</button>
            </div>

            <div className={`status ${status.type}`}>{status.message}</div>
          </Section>

          <div className="right-column">
            <Section id="usageStats" title={t.usageStats}>
              <StatItem id="todayUsage" title={t.todayUsage}>
                {usageStats.todayRequests} / {formatTokenCount(usageStats.todayTokens)}
              </StatItem>
              <StatItem id="totalUsage" title={t.totalUsage}>
                {usageStats.totalRequests} / {formatTokenCount(usageStats.totalTokens)}
              </StatItem>
              <StatItem id="creditRemaining" title={t.creditRemaining}>
                {formatTokenCount(remainingTokens(usageStats))}
              </StatItem>
              <p className="stats-note">{t.usageStatsNote}</p>
            </Section>

            <Section id="hotkeySettings" title={t.hotkeySettings}>
              <StatItem id="explainSelected" title={t.explainSelected}>
                <kbd>{shortcutModifier}</kbd>+<kbd>E</kbd>
              </StatItem>
              <StatItem id="explainSelected" title={t.mouseClick}>
                <kbd>{t.mouseClickStep}</kbd>
              </StatItem>
            </Section>
          </div>
        </div>
      </div>
    );
}

export default SettingsPage
