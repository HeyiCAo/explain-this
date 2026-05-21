// StreamUI.js - 流式显示管理
class StreamUI {
  constructor(containerElement) {
    this.container = containerElement;
    this.contentElement = null;
    this.cursorElement = null;
    this.isStreaming = false;
  }

  // 初始化显示区域
  init() {
    this.container.innerHTML = `
      <div class="stream-container">
        <div class="stream-content"></div>
        <span class="stream-cursor">▊</span>
      </div>
    `;
    this.contentElement = this.container.querySelector('.stream-content');
    this.cursorElement = this.container.querySelector('.stream-cursor');
    this.startCursorBlink();
  }

  // 光标闪烁动画
  startCursorBlink() {
    if (this.cursorInterval) clearInterval(this.cursorInterval);
    this.cursorInterval = setInterval(() => {
      if (this.cursorElement) {
        this.cursorElement.style.opacity =
          this.cursorElement.style.opacity === '0' ? '1' : '0';
      }
    }, 500);
  }

  stopCursorBlink() {
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
      this.cursorInterval = null;
    }
    if (this.cursorElement) {
      this.cursorElement.style.opacity = '0';
    }
  }

  // 开始流式显示
  startStream() {
    this.isStreaming = true;
    this.init();
    if (this.cursorElement) {
      this.cursorElement.style.opacity = '1';
    }
  }

  // 添加文本块（原始文本，未格式化）
  appendChunk(chunk, fullContent) {
    if (!this.contentElement) return;

    // 实时显示原始文本（不格式化，保持流式效果）
    this.contentElement.textContent = fullContent;

    // 自动滚动到底部
    this.scrollToBottom();
  }

  // 完成流式显示，显示格式化内容
  finishStream(formattedContent) {
    this.isStreaming = false;
    this.stopCursorBlink();

    if (this.contentElement) {
      // 替换为格式化后的 HTML
      this.contentElement.innerHTML = formattedContent;
    }

    if (this.cursorElement) {
      this.cursorElement.remove();
      this.cursorElement = null;
    }
  }

  // 显示错误
  showError(errorMessage) {
    this.isStreaming = false;
    this.stopCursorBlink();

    if (this.contentElement) {
      this.contentElement.innerHTML = `
        <div class="stream-error">
          ❌ ${errorMessage}
        </div>
      `;
    }

    if (this.cursorElement) {
      this.cursorElement.remove();
      this.cursorElement = null;
    }
  }

  // 显示加载状态
  showLoading() {
    this.container.innerHTML = `
      <div class="stream-loading">
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p>AI 正在思考...</p>
      </div>
    `;
  }

  scrollToBottom() {
    if (this.container) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }
}

if (typeof window !== 'undefined') {
  window.StreamUI = StreamUI;
}