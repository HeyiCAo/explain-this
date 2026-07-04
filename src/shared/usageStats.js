const USAGE_KEY = 'usageStats';
const DEFAULT_QUOTA_TOKENS = 1000000;
const DAILY_HISTORY_DAYS = 30;

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12);
}

function normalizeDailyRequests(stats = {}, currentDate = todayKey()) {
  const dailyRequests = {};
  const oldestDate = new Date();
  oldestDate.setHours(12, 0, 0, 0);
  oldestDate.setDate(oldestDate.getDate() - (DAILY_HISTORY_DAYS - 1));
  const oldestKey = todayKey(oldestDate);

  Object.entries(stats.dailyRequests || {}).forEach(([date, count]) => {
    if (!dateFromKey(date) || date < oldestKey || date > currentDate) return;
    dailyRequests[date] = Math.max(0, Number(count) || 0);
  });

  const legacyDate = dateFromKey(stats.date) ? stats.date : currentDate;
  const legacyRequests = Math.max(0, Number(stats.todayRequests) || 0);
  if (legacyRequests > 0 && dailyRequests[legacyDate] === undefined) {
    dailyRequests[legacyDate] = legacyRequests;
  }

  if (dailyRequests[currentDate] === undefined) dailyRequests[currentDate] = 0;
  return dailyRequests;
}

export function estimateTokens(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return 0;

  // 匹配中日韩字符
  const cjkRegex = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\uafff\u3400-\u4dbf]/g;
  const cjkMatch = normalized.match(cjkRegex);
  const cjkCount = cjkMatch ? cjkMatch.length : 0;

  // 其他字符（如英文、数字、符号）
  const restLength = normalized.length - cjkCount;
  
  // 估算：中日韩字符通常占 1-1.5 个 token（此处取1.2），其他字符按 4 个字符 1 个 token 估算
  const estimated = Math.ceil(cjkCount * 1.2 + restLength / 4);
  
  return Math.max(1, estimated);
}

export function emptyUsageStats() {
  const date = todayKey();
  return {
    date,
    todayRequests: 0,
    totalRequests: 0,
    todayTokens: 0,
    totalTokens: 0,
    quotaTokens: DEFAULT_QUOTA_TOKENS,
    dailyRequests: { [date]: 0 },
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
    dailyRequests: normalizeDailyRequests(stats, currentDate),
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
  const date = todayKey();
  const nextStats = {
    ...stats,
    todayRequests: stats.todayRequests + 1,
    totalRequests: stats.totalRequests + 1,
    todayTokens: stats.todayTokens + tokens,
    totalTokens: stats.totalTokens + tokens,
    dailyRequests: {
      ...stats.dailyRequests,
      [date]: (Number(stats.dailyRequests?.[date]) || 0) + 1,
    },
    updatedAt: Date.now(),
  };
  await setUsageStats(nextStats);
  return nextStats;
}

export function getLastSevenDays(stats, endDate = new Date()) {
  const normalized = normalizeUsageStats(stats);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(endDate);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = todayKey(date);
    return {
      date: key,
      requests: Math.max(0, Number(normalized.dailyRequests?.[key]) || 0),
    };
  });
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
