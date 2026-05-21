const USAGE_KEY = 'usageStats';
const DEFAULT_QUOTA_TOKENS = 1000000;

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function estimateTokens(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function emptyUsageStats() {
  return {
    date: todayKey(),
    todayRequests: 0,
    totalRequests: 0,
    todayTokens: 0,
    totalTokens: 0,
    quotaTokens: DEFAULT_QUOTA_TOKENS,
    updatedAt: null,
  };
}

export function normalizeUsageStats(stats = {}) {
  const currentDate = todayKey();
  const quotaTokens = Number(stats.quotaTokens) || DEFAULT_QUOTA_TOKENS;
  const base = {
    ...emptyUsageStats(),
    ...stats,
    quotaTokens,
    totalRequests: Number(stats.totalRequests) || 0,
    todayRequests: Number(stats.todayRequests) || 0,
    totalTokens: Number(stats.totalTokens) || 0,
    todayTokens: Number(stats.todayTokens) || 0,
  };

  if (base.date !== currentDate) {
    return {
      ...base,
      date: currentDate,
      todayRequests: 0,
      todayTokens: 0,
    };
  }

  return base;
}

export function getUsageStats() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve(emptyUsageStats());
      return;
    }
    chrome.storage.local.get([USAGE_KEY], (result) => {
      resolve(normalizeUsageStats(result[USAGE_KEY]));
    });
  });
}

export function setUsageStats(stats) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set({ [USAGE_KEY]: normalizeUsageStats(stats) }, resolve);
  });
}

export async function recordUsage({ inputText, outputText }) {
  const stats = await getUsageStats();
  const tokens = estimateTokens(inputText) + estimateTokens(outputText);
  const nextStats = {
    ...stats,
    todayRequests: stats.todayRequests + 1,
    totalRequests: stats.totalRequests + 1,
    todayTokens: stats.todayTokens + tokens,
    totalTokens: stats.totalTokens + tokens,
    updatedAt: Date.now(),
  };
  await setUsageStats(nextStats);
  return nextStats;
}

export function formatTokenCount(value) {
  const tokens = Number(value) || 0;
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M token`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K token`;
  return `${tokens} token`;
}

export function remainingTokens(stats) {
  const normalized = normalizeUsageStats(stats);
  return Math.max(0, normalized.quotaTokens - normalized.totalTokens);
}
