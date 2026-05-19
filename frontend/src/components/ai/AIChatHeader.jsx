const AIChatHeader = ({ onReset, onClose }) => (
  <header className="ai-widget__header">
    <div>
      <p className="ai-widget__eyebrow">AI trợ lý tìm phòng</p>
      <h2>Hỏi nhanh, gợi ý thật</h2>
    </div>
    <div className="ai-widget__header-actions">
      <button type="button" className="ai-widget__icon-btn" onClick={onReset} title="Làm mới cuộc trò chuyện">
        ↺
      </button>
      <button type="button" className="ai-widget__icon-btn" onClick={onClose} title="Đóng trợ lý">
        ×
      </button>
    </div>
  </header>
);

export default AIChatHeader;
