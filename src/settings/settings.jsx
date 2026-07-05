import { useEffect, useMemo, useRef, useState } from 'react'
import '../settingStyle.css'
import { getLastSevenDays, getUsageStats, normalizeUsageStats } from '../shared/usageStats'

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
        builtInMode: '内置 AI',
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
        sitesTitle: '已启用网站',
        sitesBody: 'Explain This 默认仅在你主动点击扩展或使用快捷键的页面运行。你也可以允许它在指定网站自动显示划词按钮。',
        sitePlaceholder: 'example.com',
        addSite: '允许网站',
        noSites: '还没有永久允许的网站。',
        remove: '移除',
        siteAdded: '网站已启用；已打开的匹配页面也会立即生效。',
        siteRemoved: '网站权限已移除。',
        invalidSite: '请输入有效的网站域名。',
        permissionDenied: '未授予网站权限。',
        advanced: '高级选项',
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
        localUsage: '使用统计',
        lastSevenDays: '最近 7 天查询次数',
        sevenDayTotal: '7 天共 {count} 次',
        queries: '{count} 次查询',
        noQueries: '最近 7 天还没有查询记录',
        onboardingEyebrow: 'Explain This 新手设置',
        onboardingStep: '第 {current} 步，共 5 步',
        back: '返回',
        continue: '继续',
        styleTitle: '你喜欢怎样的解释？',
        styleBody: '先选择默认详略，之后可以在 popup 中随时切换。',
        privacyOnboardingTitle: '数据如何传输？',
        privacyOnboardingBody: '只有你主动提交的文本会被处理。扩展不会发送当前页面网址、浏览历史或网页中的其他内容。网络请求会携带 IP；应用只保存其加盐哈希和请求计数，用于限额与滥用保护。',
        freeFlowTitle: '免费模式的数据路径',
        freeFlowBody: '扩展发送选中文本、回答语言、解释详略和随机安装 ID 到 Explain This 后端；后端执行额度与滥用保护，再将解释请求转发给 AI 服务商。原文不会保存在我们的应用数据库中。',
        byokFlowTitle: '使用自己的 API Key',
        byokFlowBody: '请求会从扩展直接发送到你选择的 AI 服务商，不经过 Explain This 后端；API Key 仅从此浏览器本地读取，用于向该服务商认证。',
        selectedTextNode: '你选择的文本',
        backendNode: 'Explain This 后端',
        providerNode: 'AI 服务商',
        resultNode: '解释结果',
        ownKeyShortcut: 'I have my own API Key',
        activationTitle: '按一次快捷键，激活当前网站',
        activationBody: '在一个网站首次使用时，先选中文字，再按快捷键。这次明确的键盘操作会让 Chrome 临时授予 Explain This 当前网站的访问权限，并立即解释所选内容。',
        shortcutMethodTitle: '第一次使用这个网站',
        shortcutMethodBody: '选中文字后按 {shortcut}。同一网站保持激活时，之后划词就会直接显示气泡；进入新网站时再按一次即可。',
        practiceTitle: '现在练习一次',
        practiceText: '选中这句话，然后按下上方的快捷键。',
        practiceInstruction: '请用鼠标选中示例句，再按 {shortcut}。',
        practiceWaiting: '完成一次练习后才能继续。',
        practiceSelectFirst: '快捷键收到了，但还没有选中示例文字。请先选中文字再试一次。',
        practiceSuccess: '练习成功！你已经掌握了第一次激活方法。',
        activationContinue: '完成练习，继续',
        readyTitle: '准备好了',
        readyBody: '每天 50 次免费解释，无需 API Key。进入新网站后，先选中文字并按一次快捷键；网站激活后，继续划词就会看到 Explain this。',
        start: '开始使用',
    },
    en: {
        settings: 'Settings',
        close: 'Close',
        github: 'GitHub Repository',
        builtInTitle: 'Free built-in API Key',
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
        saveRecentHint: 'Stores up to 10 history items and 100 cached explanations locally. Turning it off clears both.',
        privacyTitle: 'Privacy',
        privacyBody: 'Only text you explicitly submit is processed. In free mode it passes through the Explain This backend; the original text is not persisted in our application database.',
        privacyLink: 'Read the full Privacy Policy',
        sitesTitle: 'Enabled sites',
        sitesBody: 'By default, Explain This runs only after you click the extension or use its shortcut. You can also allow the selection button to appear automatically on specific sites.',
        sitePlaceholder: 'example.com',
        addSite: 'Allow site',
        noSites: 'No sites have permanent access yet.',
        remove: 'Remove',
        siteAdded: 'Site enabled. Open matching pages are active now.',
        siteRemoved: 'Site permission removed.',
        invalidSite: 'Enter a valid website domain.',
        permissionDenied: 'Site permission was not granted.',
        advanced: 'Advanced',
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
        localUsage: 'Usage',
        lastSevenDays: 'Queries in the last 7 days',
        sevenDayTotal: '{count} queries over 7 days',
        queries: '{count} queries',
        noQueries: 'No queries recorded in the last 7 days',
        onboardingEyebrow: 'Explain This setup',
        onboardingStep: 'Step {current} of 5',
        back: 'Back',
        continue: 'Continue',
        styleTitle: 'How detailed should explanations be?',
        styleBody: 'Choose a default style. You can switch it anytime in the popup.',
        privacyOnboardingTitle: 'Where does your data go?',
        privacyOnboardingBody: 'Only text you explicitly submit is processed. The extension does not send the current page URL, browsing history, or other page content. Network requests include an IP address; the app stores only salted hashes and request counters for quota and abuse protection.',
        freeFlowTitle: 'Built-in AI data path',
        freeFlowBody: 'The extension sends the selected text, response language, explanation style, and a random installation ID to the Explain This backend. The backend enforces quotas and abuse protection, then relays the explanation request to an AI provider. The original text is not stored in our application database.',
        byokFlowTitle: 'Using your own API key',
        byokFlowBody: 'Requests go directly from the extension to your chosen AI provider and bypass the Explain This backend. Your API key is read from local extension storage only to authenticate with that provider.',
        selectedTextNode: 'Selected text',
        backendNode: 'Explain This backend',
        providerNode: 'AI provider',
        resultNode: 'Explanation',
        ownKeyShortcut: 'I have my own API Key',
        activationTitle: 'Press one shortcut to activate this site',
        activationBody: 'The first time you use a website, select some text and press the shortcut. This explicit keyboard action lets Chrome temporarily grant Explain This access to the current site and immediately explains your selection.',
        shortcutMethodTitle: 'First use on a website',
        shortcutMethodBody: 'Select text and press {shortcut}. While that site stays active, later selections show the bubble directly. Press it once again when you move to a new website.',
        practiceTitle: 'Practice it now',
        practiceText: 'Select this sentence, then press the shortcut shown above.',
        practiceInstruction: 'Select the sample sentence with your pointer, then press {shortcut}.',
        practiceWaiting: 'Complete one practice attempt to continue.',
        practiceSelectFirst: 'The shortcut worked, but the sample text was not selected. Select it and try again.',
        practiceSuccess: 'Practice complete! You now know how to activate a website for the first time.',
        activationContinue: 'Finish practice and continue',
        readyTitle: 'You’re ready',
        readyBody: 'Get 50 free explanations every day with no API key. On a new website, select text and press the shortcut once. After activation, keep highlighting to reveal Explain this.',
        start: 'Start explaining',
    }
};

function format(text, values) {
    return Object.entries(values).reduce(
        (result, [key, value]) => result.replace(`{${key}}`, value),
        text,
    );
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

function syncEnabledSites() {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
            resolve();
            return;
        }
        chrome.runtime.sendMessage({ action: 'syncEnabledSites' }, () => {
            void chrome.runtime.lastError;
            resolve();
        });
    });
}

function normalizeSite(value) {
    const trimmed = String(value || '').trim().toLowerCase();
    if (!trimmed || /[\s/]/.test(trimmed.replace(/^https?:\/\//, ''))) return null;
    try {
        const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
        const hostname = url.hostname.replace(/^www\./, '');
        const supportsSubdomains = hostname !== 'localhost'
            && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
            && !hostname.startsWith('[');
        const permissionHost = supportsSubdomains ? `*.${hostname}` : hostname;
        return {
            hostname,
            origins: [
                `https://${permissionHost}/*`,
                `http://${permissionHost}/*`,
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

function UsageChart({ stats, lang, labels }) {
    const days = useMemo(() => getLastSevenDays(stats), [stats]);
    const width = 640;
    const height = 220;
    const padding = { top: 20, right: 18, bottom: 26, left: 32 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maximum = Math.max(1, ...days.map((day) => day.requests));
    const roundedMaximum = maximum <= 5 ? maximum : Math.ceil(maximum / 5) * 5;
    const points = days.map((day, index) => {
        const x = padding.left + (chartWidth * index) / (days.length - 1);
        const y = padding.top + chartHeight - (day.requests / roundedMaximum) * chartHeight;
        return { ...day, x, y };
    });
    const linePath = points.map((point, index) => (
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    )).join(' ');
    const areaPath = `${linePath} L ${points.at(-1).x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;
    const total = days.reduce((sum, day) => sum + day.requests, 0);
    const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
    const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const pointsWithLabels = points.map((point) => ({
        ...point,
        label: weekdayFormatter.format(new Date(`${point.date}T12:00:00`)),
    }));

    return (
        <div className="usage-chart">
            <div className="usage-chart-heading">
                <div>
                    <strong>{labels.lastSevenDays}</strong>
                    <span>{total === 0 ? labels.noQueries : format(labels.sevenDayTotal, { count: total })}</span>
                </div>
                <b>{total}</b>
            </div>
            <div className="usage-chart-plot">
                <span className="usage-y-label top">{roundedMaximum}</span>
                <span className="usage-y-label bottom">0</span>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    role="img"
                    aria-label={format(labels.sevenDayTotal, { count: total })}
                >
                    <title>{labels.lastSevenDays}</title>
                    <defs>
                        <linearGradient id="usage-area-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4d91e6" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#4d91e6" stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                    {[0, 0.5, 1].map((fraction) => (
                        <line
                            className="usage-grid-line"
                            x1={padding.left}
                            x2={width - padding.right}
                            y1={padding.top + chartHeight * fraction}
                            y2={padding.top + chartHeight * fraction}
                            key={fraction}
                        />
                    ))}
                    <path className="usage-area" d={areaPath} />
                    <path className="usage-line" d={linePath} pathLength="1" />
                    {pointsWithLabels.map((point) => (
                        <circle className="usage-point" cx={point.x} cy={point.y} r="5" key={point.date}>
                            <title>{format(labels.queries, { count: point.requests })}</title>
                        </circle>
                    ))}
                    {pointsWithLabels.map((point, index) => (
                        <text
                            className="usage-x-label"
                            x={point.x}
                            y={height - 3}
                            textAnchor={index === 0 ? 'start' : index === pointsWithLabels.length - 1 ? 'end' : 'middle'}
                            key={`${point.date}-label`}
                        >
                            {point.label}
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );
}

function SetupOnboarding({
    lang,
    initialSpeed,
    onComplete,
    onOpenAdvanced,
}) {
    const [step, setStep] = useState(1);
    const [speed, setSpeed] = useState(initialSpeed || 'fast');
    const [practiceComplete, setPracticeComplete] = useState(false);
    const [practiceStatus, setPracticeStatus] = useState({ message: '', type: '' });
    const practiceTextRef = useRef(null);
    const t = copy[lang];
    const overallStep = step + 1;
    const isMac = typeof navigator !== 'undefined'
        && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform);
    const shortcutLabel = isMac ? '⌘ E' : 'Ctrl + E';

    useEffect(() => {
        if (step !== 3) return undefined;

        const handlePracticeAttempt = () => {
            const practiceField = practiceTextRef.current;
            const fieldSelection = practiceField
                ? practiceField.value
                    .slice(practiceField.selectionStart, practiceField.selectionEnd)
                    .trim()
                : '';
            const selection = window.getSelection();
            const pageSelection = selection?.toString().trim() || '';
            const selectionInsidePractice = [selection?.anchorNode, selection?.focusNode]
                .filter(Boolean)
                .some((node) => practiceTextRef.current?.contains(node));

            if (fieldSelection.length < 2 && (pageSelection.length < 2 || !selectionInsidePractice)) {
                setPracticeStatus({
                    message: copy[lang].practiceSelectFirst,
                    type: 'error',
                });
                return;
            }

            setPracticeComplete(true);
            setPracticeStatus({
                message: copy[lang].practiceSuccess,
                type: 'success',
            });
            selection.removeAllRanges();
            practiceField?.setSelectionRange(0, 0);
        };

        const handleShortcutMessage = (message) => {
            if (message?.action === 'practiceShortcut') handlePracticeAttempt();
        };
        const handleKeyDown = (event) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'e') return;
            event.preventDefault();
            handlePracticeAttempt();
        };

        window.addEventListener('keydown', handleKeyDown);
        if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener(handleShortcutMessage);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
                chrome.runtime.onMessage.removeListener(handleShortcutMessage);
            }
        };
    }, [step, lang]);

    const completeOnboarding = async (openAdvanced = false) => {
        await setStorage({
            aiMode: 'builtIn',
            explainSpeed: speed,
            saveRecentExplanations: true,
            onboardingComplete: true,
            onboardingStarted: false,
        });
        if (openAdvanced) {
            onOpenAdvanced(speed);
            return;
        }
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
                    {[1, 2, 3, 4, 5].map((item) => (
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
                        <div className="settings-onboarding-icon notice">→</div>
                        <h1>{t.privacyOnboardingTitle}</h1>
                        <div className="settings-data-route" aria-label={t.freeFlowTitle}>
                            <span>{t.selectedTextNode}</span>
                            <b aria-hidden="true">→</b>
                            <span>{t.backendNode}</span>
                            <b aria-hidden="true">→</b>
                            <span>{t.providerNode}</span>
                            <b aria-hidden="true">→</b>
                            <span>{t.resultNode}</span>
                        </div>
                        <div className="settings-principle-box">
                            <strong>{t.privacyTitle}</strong>
                            <p>{t.privacyOnboardingBody}</p>
                        </div>
                        <div className="settings-principle-box">
                            <strong>{t.freeFlowTitle}</strong>
                            <p>{t.freeFlowBody}</p>
                        </div>
                        <div className="settings-principle-box byok">
                            <strong>{t.byokFlowTitle}</strong>
                            <p>{t.byokFlowBody}</p>
                        </div>
                        <div className="settings-onboarding-link-row">
                            <a className="settings-onboarding-link" href={getPrivacyUrl()} target="_blank" rel="noreferrer">
                                {t.privacyLink} ↗
                            </a>
                            <button className="settings-own-key-link" type="button" onClick={() => completeOnboarding(true)}>
                                {t.ownKeyShortcut} →
                            </button>
                        </div>
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
                    <div className="settings-onboarding-page compact activation-page">
                        <div className="settings-onboarding-icon activation">{isMac ? '⌘E' : 'Ctrl'}</div>
                        <div>
                            <h1>{t.activationTitle}</h1>
                            <p className="settings-onboarding-intro">{t.activationBody}</p>
                        </div>
                        <div className="shortcut-activation-card">
                            <div className="shortcut-key-combo" aria-label={shortcutLabel}>
                                <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>
                                <span aria-hidden="true">+</span>
                                <kbd>E</kbd>
                            </div>
                            <div>
                                <strong>{t.shortcutMethodTitle}</strong>
                                <p>{format(t.shortcutMethodBody, { shortcut: shortcutLabel })}</p>
                            </div>
                        </div>
                        <div className={`shortcut-practice-card ${practiceComplete ? 'is-complete' : ''}`}>
                            <strong>{t.practiceTitle}</strong>
                            <textarea
                                className="shortcut-practice-text"
                                ref={practiceTextRef}
                                value={t.practiceText}
                                aria-label={t.practiceTitle}
                                rows="2"
                                readOnly
                            />
                            <small>{format(t.practiceInstruction, { shortcut: shortcutLabel })}</small>
                            <div
                                className={`shortcut-practice-status ${practiceStatus.type || 'info'}`}
                                role="status"
                                aria-live="polite"
                            >
                                {practiceStatus.message || t.practiceWaiting}
                            </div>
                        </div>
                        <div className="settings-onboarding-actions">
                            <button className="settings-onboarding-secondary" onClick={() => setStep(2)}>
                                {t.back}
                            </button>
                            <button
                                className="settings-onboarding-primary practice-continue"
                                onClick={() => setStep(4)}
                                disabled={!practiceComplete}
                            >
                                {t.activationContinue}
                            </button>
                        </div>
                    </div>
                )}

                {step === 4 && (
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
                            <button className="settings-onboarding-secondary" onClick={() => setStep(3)}>
                                {t.back}
                            </button>
                            <button className="settings-onboarding-primary" onClick={() => completeOnboarding(false)}>
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
    const [providerMenuOpen, setProviderMenuOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const advancedPanelRef = useRef(null);
    const providerMenuRef = useRef(null);

    const t = copy[lang];
    const selectedProvider = useMemo(
        () => providers.find((item) => item.id === provider) || providers[0],
        [provider],
    );

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

    useEffect(() => {
        if (!providerMenuOpen) return undefined;
        const handleOutsidePointer = (event) => {
            if (!providerMenuRef.current?.contains(event.target)) {
                setProviderMenuOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleOutsidePointer);
        return () => document.removeEventListener('pointerdown', handleOutsidePointer);
    }, [providerMenuOpen]);

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
        setProviderMenuOpen(false);
        setKeyStatus({ message: '', type: '' });
        setStorage({ provider: nextProvider });
    };

    const handleModeChange = (nextMode) => {
        setAiMode(nextMode);
        void setStorage({ aiMode: nextMode });
        if (nextMode !== 'byok' || !advancedPanelRef.current) return;

        setAdvancedOpen(true);
        requestAnimationFrame(() => {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            advancedPanelRef.current?.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'start',
            });
        });
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
        await syncEnabledSites();
        setSiteStatus({ message: t.siteAdded, type: 'success' });
    };

    const handleRemoveSite = async (site) => {
        await removeOptionalOrigins(site.origins || []);
        const nextSites = enabledSites.filter((item) => item.hostname !== site.hostname);
        setEnabledSites(nextSites);
        await setStorage({ enabledSites: nextSites });
        await syncEnabledSites();
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
                onOpenAdvanced={(nextSpeed) => {
                    setSpeed(nextSpeed);
                    setAiMode('builtIn');
                    setSaveRecent(true);
                    setAdvancedOpen(true);
                    setOnboardingRequired(false);
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            advancedPanelRef.current?.scrollIntoView({
                                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                                block: 'start',
                            });
                        });
                    });
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
                    <UsageChart stats={usageStats} lang={lang} labels={t} />
                </Section>

                <section className={`advanced-panel ${advancedOpen ? 'is-open' : ''}`} ref={advancedPanelRef}>
                    <button
                        type="button"
                        className="advanced-summary"
                        aria-expanded={advancedOpen}
                        onClick={() => setAdvancedOpen((current) => !current)}
                    >
                        <span>{t.advanced}</span>
                    </button>
                    <div
                        className="advanced-collapse"
                        aria-hidden={!advancedOpen}
                        inert={!advancedOpen}
                    >
                        <div className="advanced-content">
                        <p>{t.advancedIntro}</p>
                        <div className="advanced-form-grid">
                            <div className="advanced-field">
                                <span className="advanced-field-label">{t.provider}</span>
                                <div className="custom-provider-select" ref={providerMenuRef}>
                                    <button
                                        type="button"
                                        className="custom-provider-trigger"
                                        aria-haspopup="listbox"
                                        aria-expanded={providerMenuOpen}
                                        onClick={() => setProviderMenuOpen((current) => !current)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Escape') setProviderMenuOpen(false);
                                        }}
                                    >
                                        <span className={`custom-provider-mark ${selectedProvider.id}`}>
                                            {selectedProvider.name.charAt(0)}
                                        </span>
                                        <span>{selectedProvider.name}</span>
                                        <span className="custom-provider-chevron" aria-hidden="true">⌄</span>
                                    </button>
                                    <div
                                        className={`custom-provider-menu ${providerMenuOpen ? 'is-open' : ''}`}
                                        role="listbox"
                                        aria-hidden={!providerMenuOpen}
                                    >
                                            {providers.map((item) => (
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={provider === item.id}
                                                    tabIndex={providerMenuOpen ? 0 : -1}
                                                    className={`custom-provider-option ${provider === item.id ? 'selected' : ''}`}
                                                    onClick={() => handleProviderChange(item.id)}
                                                    key={item.id}
                                                >
                                                    <span className={`custom-provider-mark ${item.id}`}>
                                                        {item.name.charAt(0)}
                                                    </span>
                                                    <span>{item.name}</span>
                                                    {provider === item.id && (
                                                        <span className="custom-provider-check" aria-hidden="true">✓</span>
                                                    )}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            </div>
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
                    </div>
                </section>
            </div>
        </div>
    );
}

export default SettingsPage
