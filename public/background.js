// background.js
console.log('🤖 Background 已启动');

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void sender;
  if (message.action === 'openPopup') {
    openExplainPopup(sendResponse);
    return true;
  }
  if (message.action === 'storeSelection') {
    const text = message.text || '';
    chrome.storage.local.set({
      lastSelectedText: text,
      shouldAutoFill: true
    }, () => {
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
          chrome.storage.local.set({
          lastSelectedText: response.text,
          shouldAutoFill: true
        }, () => {
            openExplainPopup(() => {});
          });
        }
      });
    });
  }
});
