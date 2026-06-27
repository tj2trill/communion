import type { FlagDesign } from '../lib/types';

export function Flag({ flag, className = '' }: { flag: FlagDesign; className?: string }) {
  return (
    <span
      className={`flag flag-${flag.pattern} ${className}`}
      style={{ '--flag-primary': flag.primary, '--flag-secondary': flag.secondary } as React.CSSProperties}
      aria-label={`Flag ${flag.emblem}`}
    >
      <span>{flag.emblem}</span>
    </span>
  );
}
