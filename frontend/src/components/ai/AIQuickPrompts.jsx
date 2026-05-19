const AIQuickPrompts = ({ prompts, onSend }) => (
  <div className="ai-widget__chips">
    {prompts.map(prompt => (
      <button key={prompt} type="button" className="ai-widget__chip" onClick={() => onSend(prompt)}>
        {prompt}
      </button>
    ))}
  </div>
);

export default AIQuickPrompts;
