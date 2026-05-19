const AIChatInput = ({ input, loading, onInputChange, onSend }) => (
  <form
    className="ai-widget__input"
    onSubmit={(event) => {
      event.preventDefault();
      onSend(input);
    }}
  >
    <textarea
      className="form-input ai-widget__textarea"
      rows={3}
      placeholder="Ví dụ: Tìm phòng dưới 4 triệu ở Hà Nội, có wifi và máy lạnh"
      value={input}
      onChange={event => onInputChange(event.target.value)}
      disabled={loading}
    />
    <div className="ai-widget__footer">
      <span className="ai-widget__hint">Có thể hỏi cách dùng app, tìm phòng, hoặc xin gợi ý.</span>
      <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
        {loading ? 'Đang gửi...' : 'Gửi'}
      </button>
    </div>
  </form>
);

export default AIChatInput;
