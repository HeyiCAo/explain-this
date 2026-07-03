function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] || null);
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
    const hostname = new URL(url).hostname;
    return enabledSites.some((site) => site?.hostname === hostname);
  } catch {
    return false;
  }
}

chrome.runtime.onInstalled.addListener(() => {
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
  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !isSupportedPage(tab.url)) return;
  chrome.storage.local.get(['enabledSites'], (result) => {
    const enabledSites = Array.isArray(result.enabledSites) ? result.enabledSites : [];
    if (!siteIsEnabled(tab.url, enabledSites)) return;
    ensureContentScript({ id: tabId, url: tab.url });
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'explain-selection') return;
  const tab = await queryActiveTab();
  if (!await ensureContentScript(tab)) return;

  chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' }, (response) => {
    if (chrome.runtime.lastError || !response?.text) return;
    storeSelection(response.text, null, () => openExplainPopup());
  });
});
