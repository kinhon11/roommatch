export const widgetStyles = `
  .ai-float-trigger {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: calc(var(--z-toast) - 1);
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 9999px;
    background: var(--primary);
    color: #fff;
    border: none;
    box-shadow: var(--shadow-float);
    font-weight: 700;
  }
  .ai-float-trigger:hover { transform: translateY(-1px); background: var(--primary-dark); }
  .ai-float-trigger__icon { font-size: 18px; }
  .ai-float-trigger__text { font-size: 14px; }

  .ai-widget {
    position: fixed;
    right: 24px;
    bottom: 24px;
    width: 380px;
    max-width: calc(100vw - 24px);
    z-index: var(--z-toast);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 22px;
    box-shadow: var(--shadow-float);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .ai-widget__resize-handle {
    height: 12px;
    cursor: ns-resize;
    background:
      linear-gradient(90deg, transparent 0 20%, var(--border) 20% 80%, transparent 80% 100%);
    opacity: .8;
    touch-action: none;
  }
  .ai-widget__header {
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    background: linear-gradient(180deg, var(--bg-surface) 0%, var(--primary-50) 100%);
  }
  .ai-widget__eyebrow {
    font-size: 11px;
    font-weight: 800;
    color: var(--primary-dark);
    text-transform: uppercase;
    letter-spacing: .08em;
    margin-bottom: 4px;
  }
  .ai-widget__header h2 {
    font-size: 16px;
    font-weight: 800;
    color: var(--text-primary);
  }
  .ai-widget__header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .ai-widget__icon-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-size: 18px;
    line-height: 1;
  }
  .ai-widget__icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
  .ai-widget__body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    flex: 1;
  }
  .ai-widget__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ai-widget__chip {
    padding: 7px 10px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
    background: var(--bg-warm);
    color: var(--text-secondary);
    font-size: 12px;
  }
  .ai-widget__chip:hover {
    border-color: var(--primary-100);
    background: var(--primary-50);
    color: var(--primary-dark);
  }
  .ai-widget__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-right: 2px;
  }
  .ai-widget__msg { display: flex; }
  .ai-widget__msg--user { justify-content: flex-end; }
  .ai-widget__bubble {
    max-width: 88%;
    border-radius: 16px;
    padding: 11px 13px;
    background: var(--bg-warm);
    color: var(--text-primary);
    border: 1px solid var(--border);
    line-height: 1.6;
    white-space: pre-line;
  }
  .ai-widget__msg--user .ai-widget__bubble {
    background: var(--primary);
    color: #fff;
    border-color: transparent;
  }
  .ai-widget__bubble--loading {
    color: var(--text-secondary);
    font-style: italic;
  }
  .ai-widget__error {
    color: var(--danger);
    font-size: 12px;
    background: var(--danger-light);
    border: 1px solid #fecaca;
    padding: 8px 10px;
    border-radius: var(--radius-md);
  }
  .ai-widget__insights {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ai-widget__context {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 10px 12px;
    background: var(--bg-warm);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 12px;
    color: var(--text-secondary);
  }
  .ai-widget__context strong { color: var(--text-primary); }
  .ai-widget__summary {
    background: var(--primary-50);
    border: 1px solid var(--primary-100);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .ai-widget__profile {
    background: linear-gradient(180deg, var(--bg-surface) 0%, var(--primary-50) 100%);
    border: 1px solid var(--primary-100);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .ai-widget__profile strong,
  .ai-widget__summary strong {
    color: var(--text-primary);
    display: block;
    margin-bottom: 2px;
  }
  .ai-widget__rooms {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ai-widget__room {
    display: grid;
    grid-template-columns: 68px 1fr;
    gap: 10px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--bg-surface);
    transition: var(--transition);
  }
  .ai-widget__room:hover {
    border-color: var(--primary-100);
    background: var(--bg-hover);
  }
  .ai-widget__room-img {
    width: 68px;
    height: 56px;
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 22px;
  }
  .ai-widget__room-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ai-widget__room-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ai-widget__room-body h3 {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.35;
  }
  .ai-widget__room-body p,
  .ai-widget__room-body strong {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  .ai-widget__room-body strong {
    color: var(--primary-dark);
  }
  .ai-widget__room-reason {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }
  .ai-widget__input {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
  .ai-widget__textarea {
    resize: vertical;
    min-height: 90px;
  }
  .ai-widget__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .ai-widget__hint {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.45;
  }
  @media (max-width: 640px) {
    .ai-float-trigger {
      right: 12px;
      bottom: 12px;
      padding: 12px 14px;
    }
    .ai-float-trigger__text { display: none; }
    .ai-widget {
      right: 12px;
      left: 12px;
      bottom: 12px;
      width: auto;
      height: min(76vh, 680px);
    }
  }
`;
