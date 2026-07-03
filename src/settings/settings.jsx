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
      status_conn_failed: '连接失败',
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
      status_conn_failed: 'Connection failed',
      mouseClick: 'Click',
      mouseClickStep: 'When clicking on the popup after text selection, search will automatically begin.'
    };

const onboardingZh = {
    eyebrow: 'Explain This 新手设置',
    step: '第 {current} 步，共 5 步',
    back: '返回',
    continue: '继续',
    speedTitle: '你喜欢怎样的解释？',
    speedBody: '先选择默认的解释详略。之后仍可在 popup 中随时切换。',
    fast: '简明',
    fastHint: '快速给出核心含义，最多三句话',
    detail: '详细',
    detailHint: '包含一句总结、分点说明和例子',
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
    keyBody: '粘贴你的 API Key。你可以先测试，确认无误后保存并完成设置。',
    keyLabel: '{provider} API Key',
    keyPlaceholder: '在这里粘贴 API Key',
    getKey: '获取 {provider} API Key',
    test: '测试连接',
    testing: '正在测试…',
    save: '保存并完成设置',
    saving: '正在保存…',
    enterKey: '请先输入 API Key',
    testSuccess: '连接成功，可以完成设置。',
    connectionFailed: '连接失败',
    complete: '新手设置已完成。'
};

const onboardingEn = {
    eyebrow: 'Explain This setup',
    step: 'Step {current} of 5',
    back: 'Back',
    continue: 'Continue',
    speedTitle: 'How detailed should explanations be?',
    speedBody: 'Choose your default style. You can switch it anytime from the popup.',
    fast: 'Concise',
    fastHint: 'The core meaning in no more than three sentences',
    detail: 'Detailed',
    detailHint: 'A summary followed by key points and an example',
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
    keyBody: 'Paste your API Key. You can test it first, then save it to finish setup.',
    keyLabel: '{provider} API Key',
    keyPlaceholder: 'Paste your API Key here',
    getKey: 'Get a {provider} API Key',
    test: 'Test connection',
    testing: 'Testing…',
    save: 'Save and finish setup',
    saving: 'Saving…',
    enterKey: 'Enter an API Key first',
    testSuccess: 'Connection successful. You can finish setup.',
    connectionFailed: 'Connection failed',
    complete: 'Welcome setup is complete.'
};

const onboardingProviders = [
    {
        id: 'openai',
        name: 'OpenAI',
        descriptionKey: 'providerOpenAI',
        keyUrl: 'https://platform.openai.com/api-keys',
        recommended: true,
        storageKey: 'openaiApiKey'
    },
    {
        id: 'gemini',
        name: 'Gemini',
        descriptionKey: 'providerGemini',
        keyUrl: 'https://aistudio.google.com/app/apikey',
        freeAvailable: true,
        storageKey: 'geminiApiKey'
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        descriptionKey: 'providerDeepSeek',
        keyUrl: 'https://platform.deepseek.com/api_keys',
        storageKey: 'apiKey'
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

function SettingsOnboarding({
    lang,
    initialSpeed,
    initialProvider,
    savedKeys,
    onComplete
}) {
    const [step, setStep] = useState(1);
    const [speed, setSpeed] = useState(initialSpeed || 'fast');
    const [provider, setProvider] = useState(initialProvider || 'openai');
    const initialProviderOption = onboardingProviders.find(option => option.id === initialProvider)
        || onboardingProviders[0];
    const [apiKey, setApiKey] = useState(savedKeys[initialProviderOption.storageKey] || '');
    const [status, setStatus] = useState({ message: '', type: '' });
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const t = lang === 'zh' ? onboardingZh : onboardingEn;
    const selectedProvider = onboardingProviders.find(option => option.id === provider)
        || onboardingProviders[0];
    const privacyUrl = 'https://github.com/HeyiCAo/ExplainThis/blob/main/privacy-policy.md';
    const overallStep = step + 1;

    const goToStep = (nextStep) => {
        setStatus({ message: '', type: '' });
        setStep(nextStep);
    };

    const handleSpeedChange = (nextSpeed) => {
        setSpeed(nextSpeed);
        setStorage({ explainSpeed: nextSpeed });
    };

    const handleProviderChange = (option) => {
        setProvider(option.id);
        setApiKey(savedKeys[option.storageKey] || '');
        setStatus({ message: '', type: '' });
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

        setSaving(true);
        await setStorage({
            [selectedProvider.storageKey]: normalizedKey,
            provider,
            lang,
            explainSpeed: speed,
            onboardingComplete: true,
            onboardingStarted: false
        });
        setSaving(false);
        onComplete({
            provider,
            speed,
            apiKey: normalizedKey,
            storageKey: selectedProvider.storageKey,
            message: t.complete
        });
    };

    return (
        <main className="settings-onboarding-shell">
            <section className="settings-onboarding-card">
                <div className="settings-onboarding-topline">
                    <span>{t.eyebrow}</span>
                    <span>{formatOnboardingText(t.step, { current: overallStep })}</span>
                </div>
                <div className="settings-onboarding-progress" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map(item => (
                        <span key={item} className={item <= overallStep ? 'active' : ''}></span>
                    ))}
                </div>

                {step === 1 && (
                    <div className="settings-onboarding-page">
                        <div className="settings-onboarding-icon">≡</div>
                        <div>
                            <h1>{t.speedTitle}</h1>
                            <p className="settings-onboarding-intro">{t.speedBody}</p>
                        </div>
                        <div className="settings-choice-grid speed-choices">
                            <button
                                className={`settings-choice ${speed === 'fast' ? 'selected' : ''}`}
                                onClick={() => handleSpeedChange('fast')}
                            >
                                <span className="settings-choice-icon">⚡</span>
                                <span><strong>{t.fast}</strong><small>{t.fastHint}</small></span>
                                <span className="settings-choice-radio"></span>
                            </button>
                            <button
                                className={`settings-choice ${speed === 'detail' ? 'selected' : ''}`}
                                onClick={() => handleSpeedChange('detail')}
                            >
                                <span className="settings-choice-icon">☷</span>
                                <span><strong>{t.detail}</strong><small>{t.detailHint}</small></span>
                                <span className="settings-choice-radio"></span>
                            </button>
                        </div>
                        <div className="settings-onboarding-actions single">
                            <button className="settings-onboarding-primary" onClick={() => goToStep(2)}>
                                {t.continue}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="settings-onboarding-page compact">
                        <div className="settings-onboarding-icon notice">!</div>
                        <h1>{t.noticeTitle}</h1>
                        <div className="settings-principle-box">
                            <strong>{t.principleTitle}</strong>
                            <p>{t.principleBody}</p>
                            <p className="analogy">{t.principleAnalogy}</p>
                        </div>
                        <div className="settings-notice-list">
                            <div>
                                <span>↗</span>
                                <p><strong>{t.noticePrivacyTitle}</strong>{t.noticePrivacyBody}</p>
                            </div>
                            <div>
                                <span>◇</span>
                                <p><strong>{t.noticeRiskTitle}</strong>{t.noticeRiskBody}</p>
                            </div>
                        </div>
                        <p className="settings-local-key-note">{t.localKeyNote}</p>
                        <a className="settings-onboarding-link" href={privacyUrl} target="_blank" rel="noreferrer">
                            {t.privacyPolicy} ↗
                        </a>
                        <div className="settings-onboarding-actions">
                            <button className="settings-onboarding-secondary" onClick={() => goToStep(1)}>
                                {t.back}
                            </button>
                            <button className="settings-onboarding-primary" onClick={() => goToStep(3)}>
                                {t.agree}
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="settings-onboarding-page">
                        <div className="settings-onboarding-icon">AI</div>
                        <div>
                            <h1>{t.providerTitle}</h1>
                            <p className="settings-onboarding-intro">{t.providerBody}</p>
                        </div>
                        <div className="settings-choice-grid provider-choices">
                            {onboardingProviders.map(option => (
                                <button
                                    key={option.id}
                                    className={`settings-choice ${provider === option.id ? 'selected' : ''}`}
                                    onClick={() => handleProviderChange(option)}
                                >
                                    <span className={`settings-choice-icon ${option.id}`}>
                                        {option.name.charAt(0)}
                                    </span>
                                    <span>
                                        <strong>
                                            {option.name}
                                            {option.recommended && <em>{t.recommended}</em>}
                                            {option.freeAvailable && <em className="free">{t.freeAvailable}</em>}
                                        </strong>
                                        <small>{t[option.descriptionKey]}</small>
                                    </span>
                                    <span className="settings-choice-radio"></span>
                                </button>
                            ))}
                        </div>
                        <div className="settings-onboarding-actions">
                            <button className="settings-onboarding-secondary" onClick={() => goToStep(2)}>
                                {t.back}
                            </button>
                            <button className="settings-onboarding-primary" onClick={() => goToStep(4)}>
                                {t.continue}
                            </button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="settings-onboarding-page">
                        <div className={`settings-onboarding-icon ${provider}`}>
                            {selectedProvider.name.charAt(0)}
                        </div>
                        <div>
                            <h1>{formatOnboardingText(t.keyTitle, { provider: selectedProvider.name })}</h1>
                            <p className="settings-onboarding-intro">{t.keyBody}</p>
                        </div>
                        <label className="settings-onboarding-key">
                            <span>{formatOnboardingText(t.keyLabel, { provider: selectedProvider.name })}</span>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(event) => {
                                    setApiKey(event.target.value);
                                    setStatus({ message: '', type: '' });
                                }}
                                placeholder={t.keyPlaceholder}
                                autoComplete="off"
                                spellCheck="false"
                            />
                        </label>
                        <div className="settings-key-meta">
                            <a className="settings-onboarding-link" href={selectedProvider.keyUrl}
                                target="_blank" rel="noreferrer">
                                {formatOnboardingText(t.getKey, { provider: selectedProvider.name })} ↗
                            </a>
                            <span>{t.localKeyNote}</span>
                        </div>
                        {status.message && (
                            <div className={`settings-onboarding-status ${status.type}`} role="status">
                                {status.message}
                            </div>
                        )}
                        <div className="settings-onboarding-actions key-actions">
                            <button className="settings-onboarding-secondary" onClick={() => goToStep(3)}>
                                {t.back}
                            </button>
                            <button className="settings-onboarding-secondary"
                                onClick={handleTest} disabled={testing || saving}>
                                {testing ? t.testing : t.test}
                            </button>
                            <button className="settings-onboarding-primary"
                                onClick={handleSave} disabled={testing || saving}>
                                {saving ? t.saving : t.save}
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}

function SettingsPage() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [provider, setProvider] = useState('openai');
    const [lang, setLang] = useState('zh');
    const [status, setStatus] = useState({ message: '', type: '' });
    const [usageStats, setUsageStats] = useState(normalizeUsageStats());
    const [apiKey, setApiKey] = useState('');
    const [speed, setSpeed] = useState('fast');
    const [savedKeys, setSavedKeys] = useState({
        apiKey: '',
        geminiApiKey: '',
        openaiApiKey: ''
    });
    const [onboardingRequired, setOnboardingRequired] = useState(null);
    const t = lang === 'zh' ? settingsZh : settingsEn;
    const shortcutModifier = isMacPlatform() ? 'Cmd' : 'Ctrl';
    const privacyUrl = 'https://github.com/HeyiCAo/ExplainThis/blob/main/privacy-policy.md';

    useEffect(() => {
      getStorage([
        "apiKey",
        "geminiApiKey",
        "openaiApiKey",
        "provider",
        "lang",
        "explainSpeed",
        "onboardingComplete"
      ]).then((result) => {
        const savedProvider = result.provider || 'openai';
        const nextSavedKeys = {
            apiKey: result.apiKey || '',
            geminiApiKey: result.geminiApiKey || '',
            openaiApiKey: result.openaiApiKey || ''
        };
        const hasSavedKey = Object.values(nextSavedKeys).some(key => String(key).trim());
        setProvider(savedProvider);
        setSavedKeys(nextSavedKeys);
        if (savedProvider === 'gemini') {
            setApiKey(result.geminiApiKey || '');
        } else if (savedProvider === 'openai') {
            setApiKey(result.openaiApiKey || '');
        } else {
            setApiKey(result.apiKey || '');
        }
        if (result.lang) setLang(result.lang);
        if (result.explainSpeed) setSpeed(result.explainSpeed);
        setOnboardingRequired(!(result.onboardingComplete === true || hasSavedKey));
        if (hasSavedKey && result.onboardingComplete !== true) {
            setStorage({ onboardingComplete: true, onboardingStarted: false });
        }
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
        const normalizedKey = apiKey.trim();
        if (!normalizedKey) {
            setStatus({ message: t.status_enter_key, type: 'error' });
            return;
        }
        
        let keyPayload;
        if (provider === 'gemini') {
            keyPayload = { provider, geminiApiKey: normalizedKey };
        } else if (provider === 'openai') {
            keyPayload = { provider, openaiApiKey: normalizedKey };
        } else {
            keyPayload = { provider, apiKey: normalizedKey };
        }
        
        setStorage(keyPayload);
        setApiKey(normalizedKey);
        setStatus({ message: t.status_success, type: 'success' });
    }

    async function handleTestConnection() {
        const normalizedKey = apiKey.trim();
        if (!normalizedKey) {
            setStatus({ message: t.status_enter_key, type: 'error' });
            return;
        }

        setStatus({ message: t.status_testing, type: 'info' });

        let response;
        if (provider === 'deepseek') {
            try {
                response = await fetch('https://api.deepseek.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${normalizedKey}` }
                });
            } catch (error) {
                setStatus({ message: `${t.status_conn_failed}: ${error.message}`, type: 'error' });
                return;
            }
        } else if (provider === 'gemini') {
            try {
                response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': normalizedKey
                    },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }],
                        generationConfig: { maxOutputTokens: 32, temperature: 0 }
                    })
                });
            } catch (error) {
                setStatus({ message: `${t.status_conn_failed}: ${error.message}`, type: 'error' });
                return;
            }
        } else if (provider === 'openai') {
            try {
                response = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${normalizedKey}` }
                });
            } catch (error) {
                setStatus({ message: `${t.status_conn_failed}: ${error.message}`, type: 'error' });
                return;
            }
        }

        if (response.ok) {
            setApiKey(normalizedKey);
            setStatus({ message: t.status_success, type: 'success' });
            return;
        }

        const rawBody = await response.text();
        let details;
        try {
            const payload = JSON.parse(rawBody);
            details = payload?.error?.message || JSON.stringify(payload);
        } catch {
            details = rawBody || response.statusText;
        }
        setStatus({
            message: `${t.status_conn_failed} (HTTP ${response.status})${details ? `: ${details}` : ''}`,
            type: 'error'
        });
    }

    if (onboardingRequired === null) {
        return <div className="settings-initializing" aria-label="Loading"></div>;
    }

    if (onboardingRequired) {
        return (
            <SettingsOnboarding
                lang={lang}
                initialSpeed={speed}
                initialProvider={provider}
                savedKeys={savedKeys}
                onComplete={({ provider: nextProvider, speed: nextSpeed, apiKey: nextKey, storageKey, message }) => {
                    setProvider(nextProvider);
                    setSpeed(nextSpeed);
                    setApiKey(nextKey);
                    setSavedKeys(current => ({ ...current, [storageKey]: nextKey }));
                    setStatus({ message, type: 'success' });
                    setOnboardingRequired(false);
                }}
            />
        );
    }

    return (
      <div>
        <div className="top-bar">
          <h1>
            <span>{t.settings}</span>
          </h1>
          <div className="top-actions">
            <span className="lang-switch">
              <button type="button" onClick={() => { setLang('zh'); setStorage({ lang: 'zh' }); }}
                  className={lang === 'zh' ? 'active' : ''}>中</button>
              <button type="button" onClick={() => { setLang('en'); setStorage({ lang: 'en' }); }}
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
