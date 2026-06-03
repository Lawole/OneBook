import React from 'react';

/**
 * OneBooks logo — a calm geometric mark.
 * The ring represents the "O" / a coin / a balance point.
 * The horizontal line crossing it is the ledger entry,
 * symbolic of double-entry bookkeeping where every line balances.
 */
const Logo = ({
  size = 36,
  variant = 'mark',         // 'mark' | 'mark-white' | 'wordmark' | 'lockup'
  color,                    // override fill color
  className = '',
  style = {},
}) => {
  const isLight = variant === 'mark-white';
  const bgFill = color || (isLight ? 'transparent' : 'url(#ob-grad)');
  const strokeColor = isLight ? '#ffffff' : '#f6f5f1';
  const ringStroke = isLight ? '#ffffff' : '#f6f5f1';

  if (variant === 'wordmark') {
    return (
      <span
        className={`ob-wordmark ${className}`}
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 700,
          fontSize: size,
          letterSpacing: '-0.025em',
          color: color || 'currentColor',
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'baseline',
          ...style,
        }}
      >
        OneBooks<span style={{ color: color || '#3f5b66', marginLeft: 1 }}>.</span>
      </span>
    );
  }

  if (variant === 'lockup') {
    return (
      <span
        className={`ob-lockup ${className}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28, ...style }}
      >
        <Logo size={size} variant="mark" />
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: size * 0.55,
            letterSpacing: '-0.025em',
            color: color || 'currentColor',
            lineHeight: 1,
          }}
        >
          OneBooks
        </span>
      </span>
    );
  }

  // 'mark' or 'mark-white'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`ob-logo ${className}`}
      style={style}
      aria-label="OneBooks"
    >
      <defs>
        <linearGradient id="ob-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4a6873" />
          <stop offset="100%" stopColor="#2f4751" />
        </linearGradient>
        <linearGradient id="ob-grad-soft" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* Rounded-square plate */}
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill={bgFill} />
      {isLight && (
        <rect x="0.5" y="0.5" width="39" height="39" rx="11" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" />
      )}

      {/* Soft top-light glaze */}
      {!isLight && <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="url(#ob-grad-soft)" />}

      {/* Outer ring — the "O" / coin */}
      <circle cx="20" cy="20" r="9.5" stroke={ringStroke} strokeWidth="2.2" fill="none" />

      {/* Ledger entry line — extends past the ring */}
      <line
        x1="6"
        y1="20"
        x2="34"
        y2="20"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Small accent dot above the line (the credit) */}
      <circle cx="14" cy="14.5" r="1.4" fill={strokeColor} />
      {/* Small accent dot below the line (the debit — balance) */}
      <circle cx="26" cy="25.5" r="1.4" fill={strokeColor} />
    </svg>
  );
};

export default Logo;
