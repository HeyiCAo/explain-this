(() => {
  if (globalThis.__explainThisSelectionEnabled) return;
  globalThis.__explainThisSelectionEnabled = true;

  class TextSelector {
    constructor() {
      this.selectedText = '';
      this.floatingButton = null;
      this.dismissTimer = null;
      this.language = 'en';
      this.handleTextSelection = this.handleTextSelection.bind(this);
      this.handleDocumentPointer = this.handleDocumentPointer.bind(this);
      this.loadPreferences();
      this.init();
    }

    loadPreferences() {
      if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) return;
      chrome.storage.local.get(['lang'], (result) => {
        this.language = result.lang || 'en';
      });
    }

    init() {
      // Capture-phase listeners still run on apps such as Gemini that stop
      // pointer events inside their own interactive surface.
      document.addEventListener('pointerup', this.handleTextSelection, true);
      document.addEventListener('keyup', this.handleTextSelection, true);
      document.addEventListener('pointerdown', this.handleDocumentPointer, true);
    }

    handleDocumentPointer(event) {
      if (this.floatingButton && !event.composedPath().includes(this.floatingButton)) {
        this.removeFloatingButton();
      }
    }

    handleTextSelection(event) {
      if (this.floatingButton && event.composedPath().includes(this.floatingButton)) return;
      if (event.type === 'keyup' && !event.shiftKey) return;

      const { text, rect } = this.getSelectionDetails();
      if (text.length < 2 || text.length > 5000) {
        this.removeFloatingButton();
        return;
      }
      this.selectedText = text;
      this.showFloatingButton(event, rect);
    }

    getSelectionDetails() {
      const activeElement = document.activeElement;
      if (
        activeElement
        && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)
        && Number.isInteger(activeElement.selectionStart)
        && Number.isInteger(activeElement.selectionEnd)
      ) {
        return {
          text: activeElement.value
            .slice(activeElement.selectionStart, activeElement.selectionEnd)
            .trim(),
          rect: activeElement.getBoundingClientRect(),
        };
      }

      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';
      let rect = null;
      if (text && selection?.rangeCount) {
        const rangeRect = selection.getRangeAt(0).getBoundingClientRect();
        if (rangeRect.width || rangeRect.height) rect = rangeRect;
      }
      return { text, rect };
    }

    createFloatingContent(buttonLabel, shortcutLabel, iconUrl) {
      const surface = document.createElement('span');
      surface.className = 'explain-this-floating-surface';

      const icon = document.createElement('img');
      icon.className = 'explain-this-floating-icon';
      icon.src = iconUrl;
      icon.alt = '';

      const label = document.createElement('span');
      label.className = 'explain-this-floating-label';
      label.textContent = buttonLabel;

      const shortcut = document.createElement('span');
      shortcut.className = 'explain-this-shortcut';
      shortcut.textContent = shortcutLabel;

      surface.append(icon, label, shortcut);
      return surface;
    }

    showFloatingButton(event, selectionRect) {
      this.removeFloatingButton(true);
      const shortcutLabel = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
        ? '⌘ E'
        : 'Ctrl E';
      const buttonLabel = this.language === 'zh' ? '解释这段' : 'Explain this';
      const iconUrl = chrome.runtime.getURL('icon32.png');

      this.floatingButton = document.createElement('button');
      this.floatingButton.type = 'button';
      this.floatingButton.className = 'explain-this-floating-btn';
      this.floatingButton.setAttribute('aria-label', buttonLabel);
      this.floatingButton.append(
        this.createFloatingContent(buttonLabel, shortcutLabel, iconUrl),
      );

      const estimatedWidth = 176;
      const anchorX = selectionRect?.right || event.clientX || 10;
      const anchorY = selectionRect?.top || event.clientY || 64;
      const left = Math.min(
        Math.max(10, anchorX + 12),
        Math.max(10, window.innerWidth - estimatedWidth - 10),
      );
      const top = Math.max(10, anchorY - 54);
      this.floatingButton.style.setProperty('--explain-this-left', `${left}px`);
      this.floatingButton.style.setProperty('--explain-this-top', `${top}px`);

      this.floatingButton.addEventListener('click', (clickEvent) => {
        clickEvent.stopPropagation();
        clickEvent.preventDefault();
        this.sendToPopup();
      });

      document.documentElement.appendChild(this.floatingButton);
      requestAnimationFrame(() => this.floatingButton?.classList.add('is-visible'));
      this.dismissTimer = setTimeout(() => this.removeFloatingButton(), 8000);
    }

    removeFloatingButton(immediate = false) {
      if (this.dismissTimer) {
        clearTimeout(this.dismissTimer);
        this.dismissTimer = null;
      }
      if (!this.floatingButton?.parentNode) return;

      const button = this.floatingButton;
      this.floatingButton = null;
      if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        button.remove();
        return;
      }
      button.classList.remove('is-visible');
      button.classList.add('is-leaving');
      setTimeout(() => button.remove(), 160);
    }

    sendToPopup() {
      if (!this.selectedText || typeof chrome === 'undefined') return;
      const text = this.selectedText;
      const pendingExplanation = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        text,
        createdAt: Date.now(),
      };

      try {
        chrome.storage.local.set({
          pendingExplanation,
          lastSelectedText: text,
          shouldAutoFill: true,
        }, () => {
          if (chrome.runtime.lastError) return;
          chrome.runtime.sendMessage({ action: 'openPopup' }, () => {
            void chrome.runtime.lastError;
          });
        });
      } catch {
        // The page only needs a refresh if the extension was reloaded.
      }
      this.removeFloatingButton();
    }
  }

  const selector = new TextSelector();

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      void sender;
      if (message.action === 'getSelectedText') {
        sendResponse({ text: window.getSelection()?.toString().trim() || '' });
      }
      if (message.action === 'refreshExplainThisPreferences') {
        selector.loadPreferences();
        sendResponse({ success: true });
      }
      if (message.action === 'pingExplainThis') {
        sendResponse({ ready: true });
      }
      return false;
    });
  }
})();
