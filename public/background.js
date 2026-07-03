// background.js

function openExplainPopup(sendResponse) {
  const popupUrl = chrome.runtime.getURL('popup.html');
  const openWindow = () => {
    chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 420,
      height: 640
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
    createdAt: Date.now()
  };
}

function storeSelection(text, request, callback) {
  chrome.storage.local.set({
    pendingExplanation: createPendingExplanation(text, request),
    lastSelectedText: text,
    shouldAutoFill: true
  }, callback);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void sender;
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
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'explain-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectedText' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('无法连接内容脚本，请刷新当前页面后重试', chrome.runtime.lastError);
          return;
        }
        if (response && response.text) {
          storeSelection(response.text, null, () => {
            openExplainPopup(() => {});
          });
        }
      });
    });
  }
});
