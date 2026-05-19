const AIMessageList = ({ messages, loading, bottomRef }) => (
  <div className="ai-widget__messages">
    {messages.map((message, index) => (
      <div
        key={`${message.role}-${index}`}
        className={`ai-widget__msg ${message.role === 'user' ? 'ai-widget__msg--user' : 'ai-widget__msg--bot'}`}
      >
        <div className="ai-widget__bubble">
          <p>{message.content}</p>
        </div>
      </div>
    ))}
    {loading && (
      <div className="ai-widget__msg ai-widget__msg--bot">
        <div className="ai-widget__bubble ai-widget__bubble--loading">
          Đang phân tích nhu cầu của bạn...
        </div>
      </div>
    )}
    <div ref={bottomRef} />
  </div>
);

export default AIMessageList;
