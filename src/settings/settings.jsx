import { useState, useEffect } from 'react'
import '../settingStyle.css'

const zh = {
      settings: '设置',
      apiConfig: 'API 配置',
      provider: '服务商：',
      deepseek: 'DeepSeek',
      gemini: 'Gemini',
      deepseekGuide: 'DeepSeek API Key 获取指南',
      deepseekStep1: '1. 访问 DeepSeek 官网注册',
      deepseekStep2: '2. 进入"API Keys"页面创建新密钥',
      deepseekStep3: '3. 将密钥粘贴到下方',
      geminiGuide: 'Gemini API Key 获取指南',
      geminiStep1: '1. 访问 Google AI Studio 获取密钥',
      geminiStep2: '2. 将密钥粘贴到下方',
      dataNotice: '数据说明',
      dataNoticeContent: '选中的文本将发送给您选择的 AI 服务商以生成解释。详见我们的隐私政策。',
      privacyPolicy: '隐私政策',
      apiKeyLabel: 'API Key：',
      apiKeyPlaceholder: 'sk-...',
      geminiKeyLabel: 'Gemini API Key：',
      geminiKeyPlaceholder: 'AIza...',
      saveKey: '保存密钥',
      testConnection: '测试连接',
      usageStats: '使用统计',
      todayUsage: '今日使用时长：',
      totalUsage: '累计使用时长：',
      creditRemaining: '剩余额度：',
      hotkeySettings: '快捷键',
      explainSelected: '解释选中内容：',
      quickSubmission: '快捷提交：',
      close: '关闭',
      status_enter_key: '请输入API密钥',
      status_invalid_key: '密钥格式无效',
      status_testing: '正在测试连接...',
      status_success: '连接成功！',
      status_invalid_retry: '密钥无效，请重试',
      status_conn_failed: '连接失败，请检查网络',
    };
const en = {
      settings: 'Settings',
      apiConfig: 'API Configurations',
      provider: 'Provider:',
      deepseek: 'DeepSeek',
      gemini: 'Gemini',
      deepseekGuide: 'DeepSeek API Key Required',
      deepseekStep1: '1. Visit DeepSeek to register',
      deepseekStep2: '2. Navigate to the "API Keys" page to create new keys',
      deepseekStep3: '3. Paste the key below',
      geminiGuide: 'Gemini API Key Required',
      geminiStep1: '1. Visit Google AI Studio to get an API key',
      geminiStep2: '2. Paste the key below',
      dataNotice: 'Data Notice',
      dataNoticeContent: 'Selected text will be sent to your chosen AI provider to generate explanations. See our Privacy Policy.',
      privacyPolicy: 'Privacy Policy',
      apiKeyLabel: 'API Key:',
      apiKeyPlaceholder: 'sk-...',
      geminiKeyLabel: 'Gemini API Key:',
      geminiKeyPlaceholder: 'AIza...',
      saveKey: 'Save Key',
      testConnection: 'Test Connection',
      usageStats: 'Usage Statistics',
      todayUsage: 'Time used today:',
      totalUsage: 'Time used in total:',
      creditRemaining: 'Credit remaining:',
      hotkeySettings: 'Hotkeys',
      explainSelected: 'Explain Selected:',
      quickSubmission: 'Quick Submission:',
      close: 'Close',
      status_enter_key: 'Please enter API key',
      status_invalid_key: 'Invalid API key format',
      status_testing: 'Testing connection...',
      status_success: 'Success!',
      status_invalid_retry: 'Invalid API key. Try again.',
      status_conn_failed: 'Connection failed. Check network.',
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

function SettingsPage() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [provider, setProvider] = useState('deepseek');
    const [lang, setLang] = useState('zh');
    const [status, setStatus] = useState({ message: '', type: '' });
    const [totalUsage, setTotalUsage] = useState(0);
    const [todayUsage, setTodayUsage] = useState(0);

    const [remainingQuota, setRemainingQuota] = useState('≈ 1M token')
    const [apiKey, setApiKey] = useState('');
    const t = lang === 'zh' ? zh : en;

    useEffect(() => {
      chrome.storage.local.get(["apiKey", "provider", "lang"], (result) => {
        if (result.apiKey) setApiKey(result.apiKey);
        if (result.provider) setProvider(result.provider);
        if (result.lang) setLang(result.lang);
      });
    }, []);

    useEffect(() => {
        chrome.storage.local.set({ lang });
    }, [lang]);

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
        chrome.storage.local.set({ apiKey });
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
            } catch (error) {
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
            } catch (error) {
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
            <button className="close-btn">{t.close}</button>
          </div>
        </div>

        <div className="section-grid">
          <Section id="apiConfig" title="API Configurations">
            <label htmlFor="providerToggle">{t.provider}</label>
            <div className="provider-wrap">
              <button className="provider-toggle"
                type="button" aria-haspopup="listbox"
                onClick={() => setMenuOpen(!menuOpen)}>
                {provider === 'deepseek' ? "DeepSeek" : "Gemini"}
                <span>▾</span>
              </button>
              <div className={`provider-menu${menuOpen ? ' open' : ''}`} role="listbox">
                <div className="provider-item" role="option"
                  onClick={() => { setMenuOpen(false); setProvider('deepseek'); }}>DeepSeek</div>
                <div className="provider-item" role="option"
                  onClick={() => { setMenuOpen(false); setProvider('gemini'); }}>Gemini</div>
              </div>
            </div>

            <InfoBox title={t.deepseekGuide}
              style={{ display: provider === "deepseek" ? 'block' : 'none' }}>
              <p style={{ margin: '10px 0 0 0' }}>
                {t.deepseekStep1}<br />
                {t.deepseekStep2}<br />
                {t.deepseekStep3}<br />
              </p>
            </InfoBox>

            <InfoBox title={t.dataNotice}>
              <p style={{ margin: '8px 0 0 0' }}>
                {t.dataNoticeContent}
              </p>
            </InfoBox>

            <label style={{ display: provider === "deepseek" ? 'block' : 'none' }}>{t.apiKeyLabel}</label>
            <input type="password" placeholder="sk-..."
              value={apiKey}
              style={{ display: provider === "deepseek" ? 'block' : 'none' }}
              onChange={(e) => setApiKey(e.target.value)}/>

            <InfoBox title={t.geminiGuide}
              style={{ display: provider === "gemini" ? 'block' : 'none' }}>
              <p style={{ margin: '10px 0 0 0' }}>
                {t.geminiStep1}<br />
                {t.geminiStep2}<br />
              </p>
            </InfoBox>

            <label style={{ display: provider === "gemini" ? 'block' : 'none' }}>{t.geminiKeyLabel}</label>
            <input type="password" placeholder="AIza..."
              value={apiKey}
              style={{ display: provider === "gemini" ? 'block' : 'none' }}
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
              <StatItem id="todayUsage" title={t.todayUsage}>{todayUsage}</StatItem>
              <StatItem id="totalUsage" title={t.totalUsage}>{totalUsage}</StatItem>
              <StatItem id="creditRemaining" title={t.creditRemaining}>{remainingQuota}</StatItem>
            </Section>

            <Section id="hotkeySettings" title={t.hotkeySettings}>
              <StatItem id="explainSelected" title={t.explainSelected}>
                <kbd>Ctrl</kbd>+<kbd>E</kbd>
              </StatItem>
              <StatItem id="hotkeyQuickValue" title={t.quickSubmission}>
                <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
              </StatItem>
            </Section>
          </div>
        </div>
      </div>
    );
}

export default SettingsPage