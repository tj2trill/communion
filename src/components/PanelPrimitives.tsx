export const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const decimal = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

export function Metric({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'gold' }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function Bar({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-wrap" title={`${label ?? ''} ${value.toFixed(1)}`}>
      <div className="bar-track"><span style={{ width: `${width}%` }} /></div>
      <b>{value.toFixed(0)}</b>
    </div>
  );
}
