export function GlassPanel({ children, className = '', contentClassName = '' }) {
  return (
    <div className={`glass-panel ${className}`}>
      <div className={`glass-panel__content ${contentClassName}`}>{children}</div>
    </div>
  );
}
