// background.js
console.log('🤖 Background 已启动');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openPopup') {
    chrome.action.openPopup();
    sendResponse({ success: true });
    return true;
  }
  if (message.action === 'storeSelection') {
    const text = message.text || '';
    chrome.storage.local.set({
      lastSelectedText: text,
      shouldAutoFill: true
    }, () => {
      chrome.action.openPopup();
      sendResponse({ success: true });
    });
    return true;
  }
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'explain-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectedText' }, (response) => {
        if (response && response.text) {
          chrome.storage.local.set({
            lastSelectedText: response.text,
            shouldAutoFill: true
          }, () => {
            chrome.action.openPopup();
          });
        }
      });
    });
  }
});
