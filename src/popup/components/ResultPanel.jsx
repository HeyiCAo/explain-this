function LoadingSpinner({ text }) {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-text">{text}</p>
    </div>
  );
}

function ResultError({ message }) {
  return (
    <div className="result-error">
      {message}
    </div>
  );
}

function ResultSuccess({ html }) {
  return (
    <div id="resultContent" className="result-content" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function ResultStreaming({ text }) {
  return (
    <div className="stream-container">
      <div className="stream-content">{text}</div>
      <span className="stream-cursor">▊</span>
    </div>
  );
}

function ResultPanel({ copy, result, visible, onClose }) {
  if (!visible) return null;

  return (
    <div className="result-panel">
      <div className="result-header">
        <h3 className="result-title">{copy.results_title}</h3>
        <div className="result-header-right">
          <button className="result-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>
      <div>
        {result?.type === 'loading' && <LoadingSpinner text={copy.thinking} />}
        {result?.type === 'streaming' && <ResultStreaming text={result.text || copy.thinking} />}
        {result?.type === 'error' && <ResultError message={result.message} />}
        {result?.type === 'success' && <ResultSuccess html={result.html} />}
      </div>
    </div>
  );
}

export default ResultPanel;
