function PopupHeader({ copy, aiMode, freeRemaining, onOpenSettings }) {
  return (
    <div className="popup-header">
      <div>
        <h1 className="popup-title">{copy.app_title}</h1>
        <div className="ai-mode-badge">
          <span>{aiMode === 'builtIn' ? copy.built_in : copy.byok}</span>
          {aiMode === 'builtIn' && (
            <small>{copy.free_left.replace('{count}', freeRemaining)}</small>
          )}
        </div>
      </div>
      <button
        className="settings-btn"
        onClick={onOpenSettings}
        aria-label="Settings"
        title="Settings"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="settings-icon">
          <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
          <path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a8.4 8.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A8.4 8.4 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.5 2.4-1a8.4 8.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a8.4 8.4 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5Zm-7.4 4a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Z" />
        </svg>
      </button>
    </div>
  );
}

export default PopupHeader;
