import { cn } from '@/lib/utils';

interface MascotProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export function Mascot({ size = 120, className = '', animated = false }: MascotProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn('drop-shadow-lg', animated && 'animate-bounce', className)}
    >
      <defs>
        <radialGradient id="pipGradient" cx="40%" cy="40%">
          <stop offset="0%" stopColor="#FFE4E8" />
          <stop offset="100%" stopColor="#FFC2CC" />
        </radialGradient>
      </defs>

      {/* Body */}
      <circle cx="60" cy="65" r="35" fill="url(#pipGradient)" />

      {/* Left cheek */}
      <ellipse cx="35" cy="70" rx="10" ry="8" fill="#FFB8CC" opacity="0.6" />

      {/* Right cheek */}
      <ellipse cx="85" cy="70" rx="10" ry="8" fill="#FFB8CC" opacity="0.6" />

      {/* Left eye white */}
      <circle cx="48" cy="55" r="5" fill="white" />

      {/* Right eye white */}
      <circle cx="72" cy="55" r="5" fill="white" />

      {/* Left eye pupil */}
      <circle cx="50" cy="55" r="2.5" fill="#333333" />

      {/* Right eye pupil */}
      <circle cx="70" cy="55" r="2.5" fill="#333333" />

      {/* Left eye shine */}
      <circle cx="49" cy="53" r="1" fill="white" />

      {/* Right eye shine */}
      <circle cx="71" cy="53" r="1" fill="white" />

      {/* Smile */}
      <path d="M 50 72 Q 60 80 70 72" stroke="#333333" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Stethoscope - left side */}
      <path
        d="M 30 45 Q 25 50 25 60"
        stroke="#e05a6d"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="25" cy="60" r="3" fill="#e05a6d" />

      {/* Stethoscope - right side */}
      <path
        d="M 90 45 Q 95 50 95 60"
        stroke="#e05a6d"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="95" cy="60" r="3" fill="#e05a6d" />

      {/* Heart on chest */}
      <g transform="translate(60, 70)">
        <path
          d="M 0 -4 C -3 -6 -6 -5 -6 -2 C -6 0 -3 3 0 6 C 3 3 6 0 6 -2 C 6 -5 3 -6 0 -4 Z"
          fill="#ff7a8f"
        />
      </g>

      {/* Medical plus sign */}
      <g transform="translate(60, 45)">
        <rect x="-1" y="-4" width="2" height="8" fill="#f0a8b8" />
        <rect x="-4" y="-1" width="8" height="2" fill="#f0a8b8" />
      </g>
    </svg>
  );
}

export function MascotMini({ size = 64, className = '' }: MascotProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('drop-shadow-md', className)}
    >
      <defs>
        <radialGradient id="pipMiniGradient" cx="40%" cy="40%">
          <stop offset="0%" stopColor="#FFE4E8" />
          <stop offset="100%" stopColor="#FFC2CC" />
        </radialGradient>
      </defs>

      {/* Body */}
      <circle cx="32" cy="34" r="18" fill="url(#pipMiniGradient)" />

      {/* Left cheek */}
      <ellipse cx="19" cy="36" rx="5" ry="4" fill="#FFB8CC" opacity="0.6" />

      {/* Right cheek */}
      <ellipse cx="45" cy="36" rx="5" ry="4" fill="#FFB8CC" opacity="0.6" />

      {/* Left eye */}
      <circle cx="26" cy="29" r="2.5" fill="white" />
      <circle cx="27" cy="29" r="1.2" fill="#333333" />

      {/* Right eye */}
      <circle cx="38" cy="29" r="2.5" fill="white" />
      <circle cx="37" cy="29" r="1.2" fill="#333333" />

      {/* Smile */}
      <path d="M 28 38 Q 32 41 36 38" stroke="#333333" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Heart on chest */}
      <path
        d="M 32 35 C 30.5 34 29 34.5 29 35.5 C 29 36.5 30 37.5 32 39 C 34 37.5 35 36.5 35 35.5 C 35 34.5 33.5 34 32 35 Z"
        fill="#ff7a8f"
      />
    </svg>
  );
}
