function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] || null);
    });
  });
}

function queryTabs(queryInfo = {}) {
  return new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      resolve(tabs || []);
    });
  });
}

function isSupportedPage(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

function contentScriptIsReady(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'pingExplainThis' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(response?.ready === true);
    });
  });
}

async function ensureContentScript(tab) {
  if (!tab?.id || !isSupportedPage(tab.url)) return false;
  if (await contentScriptIsReady(tab.id)) return true;
  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    return true;
  } catch {
    return false;
  }
}

function openExplainPopup(sendResponse = () => {}) {
  const popupUrl = chrome.runtime.getURL('popup.html');
  const openWindow = () => {
    chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 420,
      height: 640,
    }, () => {
      sendResponse({ success: !chrome.runtime.lastError, fallback: 'window' });
    });
  };

  try {
    const popupResult = chrome.action.openPopup();
    if (popupResult?.then) {
      popupResult
        .then(() => sendResponse({ success: true, fallback: null }))
        .catch(openWindow);
      return;
    }
    sendResponse({ success: true, fallback: null });
  } catch {
    openWindow();
  }
}

function createPendingExplanation(text, request) {
  if (request?.id && request?.text) return request;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    text,
    createdAt: Date.now(),
  };
}

function storeSelection(text, request, callback) {
  chrome.storage.local.set({
    pendingExplanation: createPendingExplanation(text, request),
    lastSelectedText: text,
    shouldAutoFill: true,
  }, callback);
}

async function activateCurrentTab() {
  const tab = await queryActiveTab();
  return ensureContentScript(tab);
}

function siteIsEnabled(url, enabledSites) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return enabledSites.some((site) => {
      const allowedHostname = String(site?.hostname || '').toLowerCase().replace(/^www\./, '');
      return allowedHostname
        && (hostname === allowedHostname || hostname.endsWith(`.${allowedHostname}`));
    });
  } catch {
    return false;
  }
}

const ENABLED_SITES_SCRIPT_ID = 'explain-this-enabled-sites';
const ALL_SITE_ORIGINS = ['https://*/*', 'http://*/*'];

function getSiteOrigins(site) {
  if (Array.isArray(site?.origins) && site.origins.length) return site.origins;
  const hostname = String(site?.hostname || '').trim().toLowerCase();
  if (!hostname) return [];
  return [`https://${hostname}/*`, `http://${hostname}/*`];
}

async function syncEnabledSiteScripts() {
  const { enabledSites: storedSites } = await chrome.storage.local.get(['enabledSites']);
  const enabledSites = Array.isArray(storedSites) ? storedSites : [];
  const matches = [...new Set(enabledSites.flatMap(getSiteOrigins))];

  if (chrome.scripting.unregisterContentScripts && chrome.scripting.registerContentScripts) {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [ENABLED_SITES_SCRIPT_ID] });
    } catch {
      // The script is not registered yet.
    }
    if (matches.length) {
      try {
        await chrome.scripting.registerContentScripts([{
          id: ENABLED_SITES_SCRIPT_ID,
          matches,
          js: ['content.js'],
          css: ['content.css'],
          runAt: 'document_idle',
          persistAcrossSessions: true,
        }]);
      } catch {
        // The onUpdated fallback below still covers future navigations.
      }
    }
  }

  const tabs = await queryTabs();
  const matchingTabs = tabs.filter((tab) => (
    tab?.id
    && isSupportedPage(tab.url)
    && siteIsEnabled(tab.url, enabledSites)
  ));
  const results = await Promise.all(matchingTabs.map((tab) => ensureContentScript(tab)));
  return results.filter(Boolean).length;
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get([
    'aiMode',
    'apiKey',
    'geminiApiKey',
    'openaiApiKey',
    'saveRecentExplanations',
  ], (result) => {
    const hasSavedKey = [result.apiKey, result.geminiApiKey, result.openaiApiKey]
      .some((key) => String(key || '').trim());
    const defaults = {};
    if (!result.aiMode) defaults.aiMode = hasSavedKey ? 'byok' : 'builtIn';
    if (typeof result.saveRecentExplanations !== 'boolean') {
      defaults.saveRecentExplanations = true;
    }
    if (Object.keys(defaults).length) chrome.storage.local.set(defaults);
  });
  chrome.storage.local.remove(['allSitesEnabled']);
  chrome.permissions.remove({ origins: ALL_SITE_ORIGINS }, () => {
    void chrome.runtime.lastError;
    syncEnabledSiteScripts().catch(() => {});
  });

  if (details.reason === 'install') {
    chrome.action.setBadgeBackgroundColor({ color: '#1769c2' });
    chrome.action.setBadgeText({ text: '1' });
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html?welcome=1'),
      active: true,
    });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || changes.onboardingComplete?.newValue !== true) return;
  chrome.action.setBadgeText({ text: '' });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void sender;
  if (message.action === 'activateCurrentTab') {
    activateCurrentTab().then((success) => sendResponse({ success }));
    return true;
  }
  if (message.action === 'openPopup') {
    openExplainPopup(sendResponse);
    return true;
  }
  if (message.action === 'storeSelection') {
    const text = message.text || '';
    storeSelection(text, message.pendingExplanation, () => {
      openExplainPopup(sendResponse);
    });
    return true;
  }
  if (message.action === 'syncEnabledSites') {
    syncEnabledSiteScripts()
      .then((activatedTabs) => {
        sendResponse({ success: true, activatedTabs });
      })
      .catch(() => {
        sendResponse({ success: false, activatedTabs: 0 });
      });
    return true;
  }
  return false;
});

chrome.runtime.onStartup.addListener(() => {
  syncEnabledSiteScripts().catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !isSupportedPage(tab.url)) return;
  // This succeeds for permanently enabled sites and for same-origin navigations
  // after activeTab was granted by the shortcut or extension action.
  ensureContentScript({ id: tabId, url: tab.url });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'explain-selection') return;
  const tab = await queryActiveTab();
  if (tab?.url?.startsWith(chrome.runtime.getURL('settings.html'))) {
    chrome.runtime.sendMessage({ action: 'practiceShortcut' }, () => {
      void chrome.runtime.lastError;
    });
    return;
  }
  if (!await ensureContentScript(tab)) return;

  chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' }, (response) => {
    if (chrome.runtime.lastError || !response?.text) return;
    storeSelection(response.text, null, () => openExplainPopup());
  });
});
