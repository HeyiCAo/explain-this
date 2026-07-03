import { useEffect, useMemo, useState } from 'react'
import '../settingStyle.css'
import { formatTokenCount, getUsageStats, normalizeUsageStats } from '../shared/usageStats'

const hasExtensionStorage = () => typeof chrome !== 'undefined' && chrome?.storage?.local;

const getStorage = (keys) => new Promise((resolve) => {
    if (!hasExtensionStorage()) {
        resolve({});
        return;
    }
    chrome.storage.local.get(keys, resolve);
});

const setStorage = (values) => new Promise((resolve) => {
    if (!hasExtensionStorage()) {
        resolve();
        return;
    }
    chrome.storage.local.set(values, resolve);
});

const removeStorage = (keys) => new Promise((resolve) => {
    if (!hasExtensionStorage()) {
        resolve();
        return;
    }
    chrome.storage.local.remove(keys, resolve);
});

const providers = [
    {
        id: 'openai',
        name: 'OpenAI',
        storageKey: 'openaiApiKey',
        keyUrl: 'https://platform.openai.com/api-keys',
        permissionOrigin: 'https://api.openai.com/*',
        placeholder: 'sk-...'
    },
    {
        id: 'gemini',
        name: 'Gemini',
        storageKey: 'geminiApiKey',
        keyUrl: 'https://aistudio.google.com/app/apikey',
        permissionOrigin: 'https://generativelanguage.googleapis.com/*',
        placeholder: 'AIza...'
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        storageKey: 'apiKey',
        keyUrl: 'https://platform.deepseek.com/api_keys',
        permissionOrigin: 'https://api.deepseek.com/*',
        placeholder: 'sk-...'
    }
];

const copy = {
    zh: {
        settings: '设置',
        close: '关闭',
        github: 'GitHub 项目',
        builtInTitle: '内置免费 AI',
        builtInBadge: '默认',
        builtInBody: '安装后直接使用，无需 API Key。每天可获得 50 次 AI 解释。',
        modeLabel: 'AI 模式',
        builtInMode: 'Built-in AI',
        builtInModeHint: '每天 50 次免费解释，无需配置',
        byokMode: '使用自己的 API Key',
        byokModeHint: '更高额度和更多控制，费用由你的服务商账户承担',
        today: '今日免费额度',
        resetsDaily: '额度每天自动恢复；后端记录才是最终依据。',
        preferences: '解释偏好',
        style: '默认解释风格',
        concise: '简明',
        detailed: '详细',
        saveRecent: '保存最近的解释',
        saveRecentHint: '在此浏览器本地保存最多 10 条历史和 100 条缓存。关闭后会清除已有内容。',
        privacyTitle: '隐私',
        privacyBody: '只处理你主动提交解释的文本。免费模式会经由 Explain This 后端转发，原文不在我们的应用数据库中持久保存。',
        privacyLink: '查看完整隐私政策',
        sitesTitle: 'Enabled sites',
        sitesBody: 'Explain This 默认仅在你主动点击扩展或使用快捷键的页面运行。你也可以允许它在指定网站自动显示划词按钮。',
        sitePlaceholder: 'example.com',
        addSite: '允许网站',
        noSites: '还没有永久允许的网站。',
        remove: '移除',
        siteAdded: '网站已启用。',
        siteRemoved: '网站权限已移除。',
        invalidSite: '请输入有效的网站域名。',
        permissionDenied: '未授予网站权限。',
        advanced: 'Advanced / Power User',
        advancedIntro: '使用自己的 API Key 以获得更高额度或直接控制服务商。普通用户不需要这里的任何设置。',
        provider: 'AI 服务商',
        apiKey: 'API Key',
        getKey: '获取 API Key',
        saveAndUse: '保存并使用此 Key',
        test: '测试连接',
        clear: '清除 Key',
        keyLocal: 'Key 仅保存在此浏览器的扩展本地存储中，并直接发送给你选择的服务商。',
        keyRequired: '请先输入 API Key。',
        keySaved: 'API Key 已保存，已切换到自带 Key 模式。',
        keyCleared: 'API Key 已清除，已切换回内置 AI。',
        testing: '正在测试连接…',
        testSuccess: '连接成功。',
        testFailed: '连接失败，请检查 Key 和网络后重试。',
        providerPermissionDenied: '需要允许连接此 AI 服务商才能使用自带 Key。',
        localUsage: '本地使用记录',
        totalRequests: '累计请求',
        tokenEstimate: '估算 Token',
        onboardingEyebrow: 'Explain This 新手设置',
        onboardingStep: '第 {current} 步，共 4 步',
        back: '返回',
        continue: '继续',
        styleTitle: '你喜欢怎样的解释？',
        styleBody: '先选择默认详略，之后可以在 popup 中随时切换。',
        privacyOnboardingTitle: '只解释你主动选择的文本',
        privacyOnboardingBody: 'Explain This 不读取浏览历史。只有当你点击 Explain this、使用快捷键或手动发送时，文本才会被处理。',
        freeFlowTitle: '免费模式如何工作？',
        freeFlowBody: '选中文本会经由 Explain This 后端安全转发给 AI 服务商。后端隐藏模型 Key、执行每日额度和滥用限制；应用不会持久保存原文。',
        readyTitle: '准备好了',
        readyBody: '每天 50 次免费解释，无需 API Key。选中文字，点击 Explain this 即可开始。',
        start: '开始使用',
    },
    en: {
        settings: 'Settings',
        close: 'Close',
        github: 'GitHub Repository',
        builtInTitle: 'Free built-in AI',
        builtInBadge: 'Default',
        builtInBody: 'Works immediately after installation. No API key required. Includes 50 AI explanations each day.',
        modeLabel: 'AI mode',
        builtInMode: 'Built-in AI',
        builtInModeHint: '50 free explanations a day, with no setup',
        byokMode: 'Use your own API key',
        byokModeHint: 'Higher limits and more control, billed by your provider',
        today: 'Free usage today',
        resetsDaily: 'The allowance resets daily. The backend record is authoritative.',
        preferences: 'Explanation preferences',
        style: 'Default explanation style',
        concise: 'Concise',
        detailed: 'Detailed',
        saveRecent: 'Save recent explanations',
        saveRecentHint: 'Stores up to 10 history items and 100 cached explanations locally in this browser. Turning it off clears both.',
        privacyTitle: 'Privacy',
        privacyBody: 'Only text you explicitly submit is processed. In free mode it passes through the Explain This backend; the original text is not persisted in our application database.',
        privacyLink: 'Read the full Privacy Policy',
        sitesTitle: 'Enabled sites',
        sitesBody: 'By default, Explain This runs only after you click the extension or use its shortcut. You can also allow the selection button to appear automatically on specific sites.',
        sitePlaceholder: 'example.com',
        addSite: 'Allow site',
        noSites: 'No sites have permanent access yet.',
        remove: 'Remove',
        siteAdded: 'Site enabled.',
        siteRemoved: 'Site permission removed.',
        invalidSite: 'Enter a valid website domain.',
        permissionDenied: 'Site permission was not granted.',
        advanced: 'Advanced / Power User',
        advancedIntro: 'Bring your own API key for higher limits or direct provider control. Most people do not need anything in this section.',
        provider: 'AI provider',
        apiKey: 'API key',
        getKey: 'Get an API key',
        saveAndUse: 'Save and use this key',
        test: 'Test connection',
        clear: 'Clear key',
        keyLocal: 'Your key stays in this browser’s local extension storage and is sent directly to the provider you choose.',
        keyRequired: 'Enter an API key first.',
        keySaved: 'API key saved. Bring Your Own Key mode is now active.',
        keyCleared: 'API key cleared. Switched back to Built-in AI.',
        testing: 'Testing connection…',
        testSuccess: 'Connection successful.',
        testFailed: 'Connection failed. Check the key and your connection, then try again.',
        providerPermissionDenied: 'Provider access is required to use your own key.',
        localUsage: 'Local usage record',
        totalRequests: 'Total requests',
        tokenEstimate: 'Estimated tokens',
        onboardingEyebrow: 'Explain This setup',
        onboardingStep: 'Step {current} of 4',
        back: 'Back',
        continue: 'Continue',
        styleTitle: 'How detailed should explanations be?',
        styleBody: 'Choose a default style. You can switch it anytime in the popup.',
        privacyOnboardingTitle: 'Only text you choose is explained',
        privacyOnboardingBody: 'Explain This does not read your browsing history. Text is processed only when you click Explain this, use the shortcut, or send it manually.',
        freeFlowTitle: 'How does the free mode work?',
        freeFlowBody: 'Selected text is securely relayed through the Explain This backend to an AI provider. The backend protects the model key and enforces quotas and abuse controls; the app does not persist the original text.',
        readyTitle: 'You’re ready',
        readyBody: 'Get 50 free explanations every day with no API key. Highlight text and click Explain this to begin.',
        start: 'Start explaining',
    }
};

function format(text, values) {
    return Object.entries(values).reduce(
        (result, [key, value]) => result.replace(`{${key}}`, value),
        text,
    );
}

function isMacPlatform() {
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function getPrivacyUrl() {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
        return chrome.runtime.getURL('privacy-policy.html');
    }
    return '/privacy-policy.html';
}

function requestOptionalOrigins(origins) {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome?.permissions?.request) {
            resolve(false);
            return;
        }
        chrome.permissions.request({ origins }, (granted) => {
            if (chrome.runtime.lastError) {
                resolve(false);
                return;
            }
            resolve(Boolean(granted));
        });
    });
}

function removeOptionalOrigins(origins) {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome?.permissions?.remove) {
            resolve(false);
            return;
        }
        chrome.permissions.remove({ origins }, (removed) => resolve(Boolean(removed)));
    });
}

function normalizeSite(value) {
    const trimmed = String(value || '').trim().toLowerCase();
    if (!trimmed || /[\s/]/.test(trimmed.replace(/^https?:\/\//, ''))) return null;
    try {
        const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
        return {
            hostname: url.hostname,
            origins: [
                `https://${url.hostname}/*`,
                `http://${url.hostname}/*`,
            ],
        };
    } catch {
        return null;
    }
}

async function testProviderConnection(provider, apiKey) {
    let response;
    if (provider === 'gemini') {
        response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }],
                    generationConfig: { maxOutputTokens: 32, temperature: 0 },
                }),
            },
        );
    } else {
        const url = provider === 'openai'
            ? 'https://api.openai.com/v1/models'
            : 'https://api.deepseek.com/v1/models';
        response = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
    }
    if (!response.ok) throw new Error('connection_failed');
}

function Section({ id, title, children, className = '' }) {
    return (
        <section className={`section ${className}`} id={id}>
            <div className="section-title"><span>{title}</span></div>
            {children}
        </section>
    );
}

function SetupOnboarding({ lang, initialSpeed, onComplete }) {
    const [step, setStep] = useState(1);
    const [speed, setSpeed] = useState(initialSpeed || 'fast');
    const t = copy[lang];
    const overallStep = step + 1;

    const finish = async () => {
        await setStorage({
            aiMode: 'builtIn',
            explainSpeed: speed,
            saveRecentExplanations: true,
            onboardingComplete: true,
            onboardingStarted: false,
        });
        onComplete(speed);
    };

    return (
        <main className="settings-onboarding-shell">
            <section className="settings-onboarding-card">
                <div className="settings-onboarding-topline">
                    <span>{t.onboardingEyebrow}</span>
                    <span>{format(t.onboardingStep, { current: overallStep })}</span>
                </div>
                <div className="settings-onboarding-progress" aria-hidden="true">
                    {[1, 2, 3, 4].map((item) => (
                        <span key={item} className={item <= overallStep ? 'active' : ''}></span>
                    ))}
                </div>

                {step === 1 && (
                    <div className="settings-onboarding-page">
                        <div className="settings-onboarding-icon">≡</div>
                        <div>
                            <h1>{t.styleTitle}</h1>
                            <p className="settings-onboarding-intro">{t.styleBody}</p>
                        </div>
                        <div className="settings-choice-grid speed-choices">
                            {[
                                ['fast', '⚡', t.concise],
                                ['detail', '☷', t.detailed],
                            ].map(([value, icon, label]) => (
                                <button
                                    key={value}
                                    className={`settings-choice ${speed === value ? 'selected' : ''}`}
                                    onClick={() => setSpeed(value)}
                                >
                                    <span className="settings-choice-icon">{icon}</span>
                                    <span><strong>{label}</strong></span>
                                    <span className="settings-choice-radio"></span>
                                </button>
                            ))}
                        </div>
                        <div className="settings-onboarding-actions single">
                            <button className="settings-onboarding-primary" onClick={() => setStep(2)}>
                                {t.continue}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="settings-onboarding-page compact">
                        <div className="settings-onboarding-icon notice">✓</div>
                        <h1>{t.privacyOnboardingTitle}</h1>
                        <div className="settings-principle-box">
                            <strong>{t.privacyTitle}</strong>
                            <p>{t.privacyOnboardingBody}</p>
                        </div>
                        <div className="settings-principle-box">
                            <strong>{t.freeFlowTitle}</strong>
                            <p>{t.freeFlowBody}</p>
                        </div>
                        <a className="settings-onboarding-link" href={getPrivacyUrl()} target="_blank" rel="noreferrer">
                            {t.privacyLink} ↗
                        </a>
                        <div className="settings-onboarding-actions">
                            <button className="settings-onboarding-secondary" onClick={() => setStep(1)}>
                                {t.back}
                            </button>
                            <button className="settings-onboarding-primary" onClick={() => setStep(3)}>
                                {t.continue}
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="settings-onboarding-page ready-page">
                        <div className="settings-ready-icon">
                            <img src="/icon128.png" alt="" />
                        </div>
                        <div>
                            <h1>{t.readyTitle}</h1>
                            <p className="settings-onboarding-intro">{t.readyBody}</p>
                        </div>
                        <div className="free-plan-callout">
                            <strong>50</strong>
                            <span>{lang === 'zh' ? '次免费解释 / 天' : 'free explanations / day'}</span>
                        </div>
                        <div className="settings-onboarding-actions">
                            <button className="settings-onboarding-secondary" onClick={() => setStep(2)}>
                                {t.back}
                            </button>
                            <button className="settings-onboarding-primary" onClick={finish}>
                                {t.start}
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}

function SettingsPage() {
    const [lang, setLang] = useState('zh');
    const [speed, setSpeed] = useState('fast');
    const [aiMode, setAiMode] = useState('builtIn');
    const [saveRecent, setSaveRecent] = useState(true);
    const [provider, setProvider] = useState('openai');
    const [apiKey, setApiKey] = useState('');
    const [savedKeys, setSavedKeys] = useState({});
    const [enabledSites, setEnabledSites] = useState([]);
    const [siteInput, setSiteInput] = useState('');
    const [siteStatus, setSiteStatus] = useState({ message: '', type: '' });
    const [keyStatus, setKeyStatus] = useState({ message: '', type: '' });
    const [testing, setTesting] = useState(false);
    const [usageStats, setUsageStats] = useState(normalizeUsageStats());
    const [freeUsage, setFreeUsage] = useState(null);
    const [onboardingRequired, setOnboardingRequired] = useState(null);

    const t = copy[lang];
    const selectedProvider = useMemo(
        () => providers.find((item) => item.id === provider) || providers[0],
        [provider],
    );
    const shortcutModifier = isMacPlatform() ? 'Cmd' : 'Ctrl';

    useEffect(() => {
        getStorage([
            'lang',
            'explainSpeed',
            'aiMode',
            'saveRecentExplanations',
            'provider',
            'apiKey',
            'geminiApiKey',
            'openaiApiKey',
            'enabledSites',
            'freeUsage',
            'onboardingComplete',
        ]).then((result) => {
            const keys = {
                apiKey: result.apiKey || '',
                geminiApiKey: result.geminiApiKey || '',
                openaiApiKey: result.openaiApiKey || '',
            };
            const hasSavedKey = Object.values(keys).some((key) => String(key).trim());
            const nextProvider = result.provider || 'openai';
            const providerConfig = providers.find((item) => item.id === nextProvider) || providers[0];

            setLang(result.lang || 'zh');
            setSpeed(result.explainSpeed || 'fast');
            setAiMode(result.aiMode || (hasSavedKey ? 'byok' : 'builtIn'));
            setSaveRecent(result.saveRecentExplanations !== false);
            setProvider(nextProvider);
            setSavedKeys(keys);
            setApiKey(keys[providerConfig.storageKey] || '');
            setEnabledSites(Array.isArray(result.enabledSites) ? result.enabledSites : []);
            setFreeUsage(result.freeUsage || null);
            setOnboardingRequired(!(result.onboardingComplete === true || hasSavedKey));

            if (hasSavedKey && result.onboardingComplete !== true) {
                setStorage({
                    onboardingComplete: true,
                    onboardingStarted: false,
                    aiMode: 'byok',
                });
            }
        });
    }, []);

    useEffect(() => {
        getUsageStats().then(setUsageStats);
        if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) return undefined;
        const handleStorageChange = (changes, areaName) => {
            if (areaName !== 'local') return;
            if (changes.usageStats) {
                setUsageStats(normalizeUsageStats(changes.usageStats.newValue));
            }
            if (changes.freeUsage) setFreeUsage(changes.freeUsage.newValue);
        };
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    const currentFreeUsage = freeUsage?.date === new Date().toISOString().slice(0, 10)
        ? freeUsage
        : { limit: 50, remaining: 50 };
    const freeLimit = Number(currentFreeUsage.limit) || 50;
    const freeRemaining = Math.max(0, Number(currentFreeUsage.remaining) || 0);
    const freeUsed = Math.max(0, freeLimit - freeRemaining);

    const handleProviderChange = (nextProvider) => {
        const config = providers.find((item) => item.id === nextProvider) || providers[0];
        setProvider(nextProvider);
        setApiKey(savedKeys[config.storageKey] || '');
        setKeyStatus({ message: '', type: '' });
        setStorage({ provider: nextProvider });
    };

    const handleModeChange = async (nextMode) => {
        setAiMode(nextMode);
        await setStorage({ aiMode: nextMode });
    };

    const handleSaveRecentChange = async (enabled) => {
        setSaveRecent(enabled);
        if (enabled) {
            await setStorage({ saveRecentExplanations: true });
            return;
        }
        await setStorage({
            saveRecentExplanations: false,
            history: [],
            explainCache: [],
        });
    };

    const handleSaveKey = async () => {
        const normalized = apiKey.trim();
        if (!normalized) {
            setKeyStatus({ message: t.keyRequired, type: 'error' });
            return;
        }
        const granted = await requestOptionalOrigins([selectedProvider.permissionOrigin]);
        if (!granted) {
            setKeyStatus({ message: t.providerPermissionDenied, type: 'error' });
            return;
        }
        await setStorage({
            [selectedProvider.storageKey]: normalized,
            provider,
            aiMode: 'byok',
        });
        setSavedKeys((current) => ({ ...current, [selectedProvider.storageKey]: normalized }));
        setApiKey(normalized);
        setAiMode('byok');
        setKeyStatus({ message: t.keySaved, type: 'success' });
    };

    const handleClearKey = async () => {
        await removeStorage(selectedProvider.storageKey);
        await removeOptionalOrigins([selectedProvider.permissionOrigin]);
        setSavedKeys((current) => ({ ...current, [selectedProvider.storageKey]: '' }));
        setApiKey('');
        setAiMode('builtIn');
        await setStorage({ aiMode: 'builtIn' });
        setKeyStatus({ message: t.keyCleared, type: 'success' });
    };

    const handleTestConnection = async () => {
        const normalized = apiKey.trim();
        if (!normalized) {
            setKeyStatus({ message: t.keyRequired, type: 'error' });
            return;
        }
        const granted = await requestOptionalOrigins([selectedProvider.permissionOrigin]);
        if (!granted) {
            setKeyStatus({ message: t.providerPermissionDenied, type: 'error' });
            return;
        }
        setTesting(true);
        setKeyStatus({ message: t.testing, type: 'info' });
        try {
            await testProviderConnection(provider, normalized);
            setKeyStatus({ message: t.testSuccess, type: 'success' });
        } catch {
            setKeyStatus({ message: t.testFailed, type: 'error' });
        } finally {
            setTesting(false);
        }
    };

    const handleAddSite = async () => {
        const site = normalizeSite(siteInput);
        if (!site) {
            setSiteStatus({ message: t.invalidSite, type: 'error' });
            return;
        }
        const granted = await requestOptionalOrigins(site.origins);
        if (!granted) {
            setSiteStatus({ message: t.permissionDenied, type: 'error' });
            return;
        }
        const nextSites = [
            ...enabledSites.filter((item) => item.hostname !== site.hostname),
            site,
        ].sort((left, right) => left.hostname.localeCompare(right.hostname));
        setEnabledSites(nextSites);
        setSiteInput('');
        await setStorage({ enabledSites: nextSites });
        setSiteStatus({ message: t.siteAdded, type: 'success' });
    };

    const handleRemoveSite = async (site) => {
        await removeOptionalOrigins(site.origins || []);
        const nextSites = enabledSites.filter((item) => item.hostname !== site.hostname);
        setEnabledSites(nextSites);
        await setStorage({ enabledSites: nextSites });
        setSiteStatus({ message: t.siteRemoved, type: 'success' });
    };

    const handleClose = () => {
        if (typeof chrome !== 'undefined' && chrome?.tabs?.getCurrent && chrome?.tabs?.remove) {
            chrome.tabs.getCurrent((tab) => {
                if (tab?.id) chrome.tabs.remove(tab.id);
                else window.close();
            });
            return;
        }
        window.close();
    };

    if (onboardingRequired === null) {
        return <div className="settings-initializing" aria-label="Loading"></div>;
    }

    if (onboardingRequired) {
        return (
            <SetupOnboarding
                lang={lang}
                initialSpeed={speed}
                onComplete={(nextSpeed) => {
                    setSpeed(nextSpeed);
                    setAiMode('builtIn');
                    setSaveRecent(true);
                    setOnboardingRequired(false);
                }}
            />
        );
    }

    return (
        <div className="settings-page">
            <div className="top-bar">
                <h1>{t.settings}</h1>
                <div className="top-actions">
                    <a className="github-link" href="https://github.com/HeyiCAo/ExplainThis" target="_blank" rel="noreferrer">
                        {t.github}<span aria-hidden="true">↗</span>
                    </a>
                    <span className="lang-switch">
                        <button type="button" onClick={() => { setLang('zh'); setStorage({ lang: 'zh' }); }}
                            className={lang === 'zh' ? 'active' : ''}>中</button>
                        <button type="button" onClick={() => { setLang('en'); setStorage({ lang: 'en' }); }}
                            className={lang === 'en' ? 'active' : ''}>EN</button>
                    </span>
                    <button className="close-btn" onClick={handleClose}>{t.close}</button>
                </div>
            </div>

            <div className="settings-layout">
                <Section id="builtInAI" title={t.builtInTitle} className="hero-section">
                    <div className="built-in-intro">
                        <span className="plan-badge">{t.builtInBadge}</span>
                        <p>{t.builtInBody}</p>
                    </div>
                    <label>{t.modeLabel}</label>
                    <div className="mode-choice-grid">
                        <button
                            className={`mode-choice ${aiMode === 'builtIn' ? 'selected' : ''}`}
                            onClick={() => handleModeChange('builtIn')}
                        >
                            <span className="mode-choice-icon">✦</span>
                            <span><strong>{t.builtInMode}</strong><small>{t.builtInModeHint}</small></span>
                            <span className="settings-choice-radio"></span>
                        </button>
                        <button
                            className={`mode-choice ${aiMode === 'byok' ? 'selected' : ''}`}
                            onClick={() => handleModeChange('byok')}
                        >
                            <span className="mode-choice-icon">⌁</span>
                            <span><strong>{t.byokMode}</strong><small>{t.byokModeHint}</small></span>
                            <span className="settings-choice-radio"></span>
                        </button>
                    </div>
                    <div className="quota-card">
                        <div>
                            <span>{t.today}</span>
                            <strong>{freeUsed} / {freeLimit}</strong>
                        </div>
                        <div className="quota-track" aria-label={`${freeUsed} / ${freeLimit}`}>
                            <span style={{ width: `${Math.min(100, (freeUsed / freeLimit) * 100)}%` }}></span>
                        </div>
                        <small>{t.resetsDaily}</small>
                    </div>
                </Section>

                <Section id="preferences" title={t.preferences}>
                    <label>{t.style}</label>
                    <div className="segmented-setting">
                        <button className={speed === 'fast' ? 'active' : ''}
                            onClick={() => { setSpeed('fast'); setStorage({ explainSpeed: 'fast' }); }}>
                            {t.concise}
                        </button>
                        <button className={speed === 'detail' ? 'active' : ''}
                            onClick={() => { setSpeed('detail'); setStorage({ explainSpeed: 'detail' }); }}>
                            {t.detailed}
                        </button>
                    </div>
                    <label className="toggle-setting">
                        <span>
                            <strong>{t.saveRecent}</strong>
                            <small>{t.saveRecentHint}</small>
                        </span>
                        <input
                            type="checkbox"
                            checked={saveRecent}
                            onChange={(event) => handleSaveRecentChange(event.target.checked)}
                        />
                    </label>
                    <div className="privacy-note">
                        <strong>{t.privacyTitle}</strong>
                        <p>{t.privacyBody}</p>
                        <a href={getPrivacyUrl()} target="_blank" rel="noreferrer">{t.privacyLink} ↗</a>
                    </div>
                </Section>

                <Section id="enabledSites" title={t.sitesTitle}>
                    <p className="section-copy">{t.sitesBody}</p>
                    <div className="site-add-row">
                        <input
                            type="text"
                            value={siteInput}
                            placeholder={t.sitePlaceholder}
                            onChange={(event) => setSiteInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') handleAddSite();
                            }}
                        />
                        <button className="primary-btn" onClick={handleAddSite}>{t.addSite}</button>
                    </div>
                    <div className="site-list">
                        {enabledSites.length === 0 && <p className="empty-sites">{t.noSites}</p>}
                        {enabledSites.map((site) => (
                            <div className="site-row" key={site.hostname}>
                                <span>
                                    <span className="site-dot"></span>
                                    {site.hostname}
                                </span>
                                <button onClick={() => handleRemoveSite(site)}>{t.remove}</button>
                            </div>
                        ))}
                    </div>
                    {siteStatus.message && (
                        <div className={`status ${siteStatus.type}`}>{siteStatus.message}</div>
                    )}
                </Section>

                <Section id="usage" title={t.localUsage}>
                    <div className="stat-item">
                        <span className="stat-label">{t.totalRequests}</span>
                        <span className="stat-value">{usageStats.totalRequests}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">{t.tokenEstimate}</span>
                        <span className="stat-value">{formatTokenCount(usageStats.totalTokens)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">{lang === 'zh' ? '划词快捷键' : 'Selection shortcut'}</span>
                        <span className="stat-value"><kbd>{shortcutModifier}</kbd>+<kbd>E</kbd></span>
                    </div>
                </Section>

                <details className="advanced-panel">
                    <summary>{t.advanced}</summary>
                    <div className="advanced-content">
                        <p>{t.advancedIntro}</p>
                        <div className="advanced-form-grid">
                            <label>
                                <span>{t.provider}</span>
                                <select value={provider} onChange={(event) => handleProviderChange(event.target.value)}>
                                    {providers.map((item) => (
                                        <option value={item.id} key={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>{t.apiKey}</span>
                                <input
                                    type="password"
                                    value={apiKey}
                                    placeholder={selectedProvider.placeholder}
                                    onChange={(event) => {
                                        setApiKey(event.target.value);
                                        setKeyStatus({ message: '', type: '' });
                                    }}
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                            </label>
                        </div>
                        <div className="advanced-meta">
                            <a href={selectedProvider.keyUrl} target="_blank" rel="noreferrer">{t.getKey} ↗</a>
                            <span>{t.keyLocal}</span>
                        </div>
                        <div className="button-group">
                            <button className="primary-btn" onClick={handleSaveKey}>{t.saveAndUse}</button>
                            <button className="secondary-btn" onClick={handleTestConnection} disabled={testing}>{t.test}</button>
                            <button className="danger-btn" onClick={handleClearKey}>{t.clear}</button>
                        </div>
                        {keyStatus.message && (
                            <div className={`status ${keyStatus.type}`}>{keyStatus.message}</div>
                        )}
                    </div>
                </details>
            </div>
        </div>
    );
}

export default SettingsPage
