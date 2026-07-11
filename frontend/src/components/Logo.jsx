import React from 'react';

function Logo({ className = '', width = 36, height = 36, showGlow = true }) {
  const glowFilterId = `logo-glow-${width}-${height}`;
  const gradId = `logo-grad-${width}-${height}`;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg 
        className={`wired-logo-svg ${className}`} 
        width={width} 
        height={height} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>
          {`
            @keyframes spinHUD {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes nodePulse {
              0% { r: 5px; opacity: 0.7; }
              50% { r: 7.5px; opacity: 1; }
              100% { r: 5px; opacity: 0.7; }
            }
            .hud-ring-${width} {
              transform-origin: 50px 50px;
              animation: spinHUD 25s linear infinite;
            }
            .glow-node-${width} {
              animation: nodePulse 2.5s ease-in-out infinite;
            }
          `}
        </style>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8a2be2" />
            <stop offset="100%" stopColor="#00ffff" />
          </linearGradient>
          {showGlow && (
            <filter id={glowFilterId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          )}
        </defs>
        {/* Outer rotating segmented HUD ring */}
        <circle 
          cx="50" 
          cy="50" 
          r="44" 
          stroke={`url(#${gradId})`} 
          strokeWidth="4" 
          strokeDasharray="200 40 40 40"
          className={`hud-ring-${width}`}
          fill="rgba(10, 11, 16, 0.45)" 
        />
        {/* Subtle inner accent ring */}
        <circle 
          cx="50" 
          cy="50" 
          r="38" 
          stroke="rgba(0, 255, 255, 0.12)" 
          strokeWidth="1" 
          strokeDasharray="4 8"
        />
        {/* Glowing "W" connecting wire path */}
        <path 
          d="M25 45L40 68L50 50L60 68L75 45" 
          stroke={`url(#${gradId})`} 
          strokeWidth="7" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          filter={showGlow ? `url(#${glowFilterId})` : undefined} 
        />
        {/* Glowing node at the top-center */}
        <circle 
          cx="50" 
          cy="32" 
          r="6" 
          fill="#00ffff" 
          className={`glow-node-${width}`}
          filter={showGlow ? `url(#${glowFilterId})` : undefined} 
        />
      </svg>
    </div>
  );
}

export default Logo;
