import type { CSSProperties } from 'react';

interface CampusSyncBrandProps {
  compact?: boolean;
  dark?: boolean;
  className?: string;
}

export default function CampusSyncBrand({ compact = false, className = '' }: CampusSyncBrandProps) {
  const iconSize = compact ? 40 : 92;
  const titleSize = compact ? 'text-xl sm:text-2xl' : 'text-4xl sm:text-5xl';
  const taglineSize = compact ? 'text-[8px] sm:text-[9px]' : 'text-xs sm:text-sm';
  const iconStyle: CSSProperties = { width: iconSize, height: iconSize };

  const purple = '#7564e8';

  return (
    <div className={`flex ${compact ? 'items-center gap-2' : 'flex-col items-center gap-3'} ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        style={iconStyle}
        className="shrink-0 cs-brand-icon"
        fill="none"
      >
        <path
          d="M50 18c-15 0-23 11-23 28v11c0 9-4 14-8 19-2 3 0 6 5 6h17c2 6 5 9 9 9s7-3 9-9h17c5 0 7-3 5-6-4-5-8-10-8-19V46c0-17-8-28-23-28Z"
          className="cs-brand-navy"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M43 19c0-5 3-8 7-8s7 3 7 8"
          className="cs-brand-navy"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M62 43c-3-3-6-5-11-5-8 0-13 5-13 13s5 13 13 13c5 0 8-2 11-5"
          className="cs-brand-navy"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path d="M78 25l8-13M88 36l12-5M89 49l12 1" stroke={purple} strokeWidth="6" strokeLinecap="round" />
      </svg>
      <div className={`${compact ? 'min-w-0' : 'text-center'}`}>
        <div className={`${titleSize} font-semibold leading-none tracking-tight whitespace-nowrap`}>
          <span className="cs-brand-navy-text">Campus</span>
          <span style={{ color: purple }}>Sync</span>
        </div>
        <p className={`${taglineSize} mt-1.5 font-medium tracking-[0.08em] text-slate-500 dark:text-slate-400 whitespace-nowrap`}>
          Notices · Events · Opportunities
        </p>
      </div>
    </div>
  );
}
