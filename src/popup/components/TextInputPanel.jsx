function TextInputPanel({
  copy,
  inputText,
  loading,
  language,
  speed,
  langMenuOpen,
  langWrapRef,
  onInputChange,
  onSubmit,
  onToggleLanguageMenu,
  onLanguageChange,
  onSpeedChange,
}) {
  return (
    <>
      <textarea
        className="input-area"
        value={inputText}
        disabled={loading}
        onChange={onInputChange}
        placeholder={copy.input_placeholder}
        rows={4}
      />

      <div className="action-bar">
        <button className="ask-btn" onClick={onSubmit} disabled={loading}>
          {loading ? copy.thinking : copy.ask_ai}
        </button>

        <div ref={langWrapRef} className="lang-wrap">
          <button className="lang-toggle" onClick={onToggleLanguageMenu}>
            {language.toUpperCase()}
          </button>
          {langMenuOpen && (
            <div className="lang-menu open">
              {['zh', 'en'].map((lang) => (
                <div
                  key={lang}
                  className={`lang-option ${language === lang ? 'active' : ''}`}
                  onClick={() => onLanguageChange(lang)}
                >
                  {lang.toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="speed-bar">
        <span className="speed-label">{copy.speed_label}</span>
        <div className="speed-toggle-group">
          {['fast', 'detail'].map((nextSpeed) => (
            <button
              key={nextSpeed}
              className={`speed-btn ${speed === nextSpeed ? 'active' : ''}`}
              onClick={() => onSpeedChange(nextSpeed)}
            >
              {copy[`speed_${nextSpeed}`]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default TextInputPanel;
