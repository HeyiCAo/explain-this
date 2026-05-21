// content.js - 最终修复版（含悬停膨胀和淡入动画）
console.log('🎯 Explain This 内容脚本已启动');

class TextSelector {
  constructor() {
    this.selectedText = '';
    this.floatingButton = null;
    this.init();
  }

  init() {
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    document.addEventListener('mousedown', (e) => {
      if (this.floatingButton && !this.floatingButton.contains(e.target)) {
        this.removeFloatingButton();
      }
    });
  }

  handleTextSelection(event) {
    if (this.floatingButton && this.floatingButton.contains(event.target)) {
      return;
    }
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length < 2 || text.length > 500) {
      this.removeFloatingButton();
      return;
    }
    this.selectedText = text;
    this.showFloatingButton(event);
    console.log('📝 选中文字:', text.substring(0, 30));
  }

  showFloatingButton(event) {
    this.removeFloatingButton();

    this.floatingButton = document.createElement('div');
    this.floatingButton.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #4da3ff, #0066cc);
        color: white;
        padding: 10px 16px;
        border-radius: 50px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(77, 163, 255, 0.4);
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        transition: all 0.2s ease;
        border: 1px solid rgba(255,255,255,0.2);
        backdrop-filter: blur(4px);
        opacity: 0;
        transform: translateY(10px);
      ">
        <span style="font-size: 16px;">🤔</span>
        <span>What does this mean?</span>
        <span style="
          font-size: 12px;
          opacity: 0.9;
          background: rgba(255,255,255,0.2);
          padding: 2px 8px;
          border-radius: 20px;
          margin-left: 4px;
        ">Ctrl+E</span>
      </div>
    `;

    const x = event.pageX;
    const y = event.pageY;
    const viewportWidth = window.innerWidth;
    let left = x + 15;
    if (left + 220 > viewportWidth) left = viewportWidth - 240;

    this.floatingButton.style.position = 'absolute';
    this.floatingButton.style.left = `${left}px`;
    this.floatingButton.style.top = `${y - 60}px`;
    this.floatingButton.style.zIndex = '10000';

    const buttonDiv = this.floatingButton.querySelector('div');
    requestAnimationFrame(() => {
      buttonDiv.style.opacity = '1';
      buttonDiv.style.transform = 'translateY(0)';
    });

    this.floatingButton.addEventListener('mouseenter', () => {
      buttonDiv.style.transform = 'scale(1.05) translateY(-2px)';
      buttonDiv.style.boxShadow = '0 8px 20px rgba(77, 163, 255, 0.6)';
    });
    this.floatingButton.addEventListener('mouseleave', () => {
      buttonDiv.style.transform = 'scale(1) translateY(0)';
      buttonDiv.style.boxShadow = '0 4px 12px rgba(77, 163, 255, 0.4)';
    });

    this.floatingButton.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('🖱️ 浮动按钮点击事件触发');
      this.sendToPopup();
    });

    document.body.appendChild(this.floatingButton);
    console.log('✅ 浮动按钮已添加到页面');

    setTimeout(() => this.removeFloatingButton(), 8000);
  }

  removeFloatingButton() {
    if (this.floatingButton && this.floatingButton.parentNode) {
      this.floatingButton.remove();
      this.floatingButton = null;
      console.log('🗑️ 浮动按钮已移除');
    }
  }

  sendToPopup() {
    if (!this.selectedText) {
      console.warn('⚠️ 没有选中的文字');
      return;
    }
    console.log('📢 sendToPopup 被调用！文字:', this.selectedText.substring(0, 30));

    const text = this.selectedText;
    const hasChrome = typeof chrome !== 'undefined';
    if (!hasChrome) {
      console.warn('⚠️ chrome API 不可用，无法发送到扩展');
      return;
    }
    try {
      const canStore = chrome.storage?.local?.set;
      if (!chrome.runtime?.id) {
        console.warn('⚠️ 扩展上下文已失效，跳过发送');
        return;
      }
      if (canStore) {
        chrome.storage.local.set({
          lastSelectedText: text,
          shouldAutoFill: true
        }, () => {
          console.log('💾 文字已存储，准备打开popup');
          chrome.runtime?.sendMessage({ action: 'openPopup' }, () => {
            if (chrome.runtime.lastError) {
              console.warn('background不可用，尝试直接打开', chrome.runtime.lastError);
            }
          });
        });
      } else {
        console.warn('⚠️ storage.local不可用，改由background处理');
        chrome.runtime?.sendMessage({ action: 'storeSelection', text }, () => {
          if (chrome.runtime.lastError) {
            console.warn('background不可用，无法存储选区', chrome.runtime.lastError);
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ Extension context invalidated', error);
    }

    this.removeFloatingButton();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initTextSelector(); });
} else {
  initTextSelector();
}

function initTextSelector() {
  const selector = new TextSelector();
  if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
    chrome.storage.local.get(['uiLanguage'], (result) => {
      selector.uiLanguage = result.uiLanguage || 'zh';
    });
  } else {
    selector.uiLanguage = 'zh';
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getSelectedText') {
      const selection = window.getSelection();
      sendResponse({ text: selection.toString().trim() });
    }
    return true;
  });
}
