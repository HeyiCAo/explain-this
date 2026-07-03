class TextSelector {
  constructor() {
    this.selectedText = '';
    this.floatingButton = null;
    this.dismissTimer = null;
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
  }

  showFloatingButton(event) {
    this.removeFloatingButton(true);
    const shortcutLabel = /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'Cmd+E' : 'Ctrl+E';

    this.floatingButton = document.createElement('div');
    this.floatingButton.className = 'explain-this-floating-btn';
    this.floatingButton.innerHTML = `
      <div class="explain-this-floating-surface" style="
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
        <span class="explain-this-floating-icon" style="font-size: 16px;">🤔</span>
        <span class="explain-this-floating-label">What does this mean?</span>
        <span class="explain-this-shortcut" style="
          font-size: 12px;
          opacity: 0.9;
          background: rgba(255,255,255,0.2);
          padding: 2px 8px;
          border-radius: 20px;
          margin-left: 4px;
        ">${shortcutLabel}</span>
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
      this.sendToPopup();
    });

    document.body.appendChild(this.floatingButton);

    this.dismissTimer = setTimeout(() => this.removeFloatingButton(), 8000);
  }

  removeFloatingButton(immediate = false) {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    if (!this.floatingButton || !this.floatingButton.parentNode) return;

    const button = this.floatingButton;
    this.floatingButton = null;
    if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      button.remove();
      return;
    }

    button.classList.add('is-leaving');
    const surface = button.querySelector('.explain-this-floating-surface');
    if (surface) {
      surface.style.opacity = '0';
      surface.style.transform = 'translateY(6px) scale(0.96)';
    }
    setTimeout(() => button.remove(), 180);
  }

  sendToPopup() {
    if (!this.selectedText) {
      console.warn('⚠️ 没有选中的文字 No text is selected');
      return;
    }

    const text = this.selectedText;
    const pendingExplanation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      text,
      createdAt: Date.now()
    };
    const hasChrome = typeof chrome !== 'undefined';
    if (!hasChrome) {
      console.warn('⚠️ Chrome API 不可用，无法发送到扩展');
      return;
    }
    const openFallbackWindow = () => {
      try {
        window.open(chrome.runtime.getURL('popup.html'), 'explain-this-popup', 'width=420,height=640');
      } catch (error) {
        console.warn('⚠️ 无法直接打开 popup，请刷新页面后重试', error);
      }
    };
    try {
      const canStore = chrome.storage?.local?.set;
      if (canStore) {
        chrome.storage.local.set({
          pendingExplanation,
          lastSelectedText: text,
          shouldAutoFill: true
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn('⚠️ 存储选区失败，可能需要刷新当前页面', chrome.runtime.lastError);
            return;
          }
          chrome.runtime?.sendMessage({ action: 'openPopup' }, () => {
            if (chrome.runtime.lastError) {
              console.warn('background不可用，尝试直接打开', chrome.runtime.lastError);
              openFallbackWindow();
            }
          });
        });
      } else {
        console.warn('⚠️ storage.local不可用，改由background处理');
        chrome.runtime?.sendMessage({ action: 'storeSelection', text, pendingExplanation }, () => {
          if (chrome.runtime.lastError) {
            console.warn('background不可用，无法存储选区', chrome.runtime.lastError);
            openFallbackWindow();
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ Extension context invalidated，请刷新当前页面后重试', error);
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
