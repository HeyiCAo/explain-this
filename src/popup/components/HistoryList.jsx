function HistoryItem({ item, onClick }) {
  return (
    <div className="history-item" onClick={onClick}>
      <span className="history-item-text">{item.text}</span>
      <span className="history-item-meta">
        {(item.language || 'zh').toUpperCase()} · {item.timestamp}
      </span>
    </div>
  );
}

function HistoryList({
  copy,
  historyList,
  showAllHistory,
  onClear,
  onSelect,
  onToggleShowAll,
}) {
  if (historyList.length === 0) return null;

  return (
    <div className="history-panel">
      <div className="history-header">
        <h3 className="history-title">{copy.history_title}</h3>
        <button className="clear-history-btn" onClick={onClear}>
          {copy.clear_history}
        </button>
      </div>
      {(showAllHistory ? historyList : historyList.slice(0, 5)).map((item, index) => (
        <HistoryItem
          key={`${item.key || item.text}-${index}`}
          item={item}
          onClick={() => onSelect(item)}
        />
      ))}
      {historyList.length > 5 && (
        <button
          type="button"
          className="history-more-btn"
          aria-expanded={showAllHistory}
          onClick={onToggleShowAll}
        >
          {showAllHistory ? copy.less_history : `${copy.more_history} (${historyList.length - 5})`}
          <span aria-hidden="true">{showAllHistory ? '↑' : '↓'}</span>
        </button>
      )}
    </div>
  );
}

export default HistoryList;
