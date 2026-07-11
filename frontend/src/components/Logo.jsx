import React from 'react';

function Logo({ className = '', width = 36, height = 36, variant = 'icon' }) {
  if (variant === 'full') {
    return (
      <img 
        src="/wired_io_logo.png" 
        alt="wired-io brand" 
        className={className} 
        style={{ 
          width: width, 
          height: 'auto', 
          display: 'block', 
          objectFit: 'contain',
          filter: 'drop-shadow(0 4px 12px rgba(0, 162, 255, 0.25))'
        }}
      />
    );
  }

  // High-fidelity vector icon styled to match the circuit trace aesthetic of the main logo
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
        style={{ filter: 'drop-shadow(0 2px 6px rgba(0, 162, 255, 0.15))' }}
      >
        <style>
          {`
            @keyframes spinHUD {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes nodePulse {
              0% { r: 5px; opacity: 0.8; }
              50% { r: 7px; opacity: 1; }
              100% { r: 5px; opacity: 0.8; }
            }
            .hud-ring-${width} {
              transform-origin: 50px 50px;
              animation: spinHUD 25s linear infinite;
            }
            .glow-node-${width} {
              animation: nodePulse 2s ease-in-out infinite;
            }
          `}
        </style>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0052d4" />
            <stop offset="50%" stopColor="#4364f7" />
            <stop offset="100%" stopColor="#6fb1fc" />
          </linearGradient>
          <filter id={glowFilterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Outer rotating HUD ring */}
        <circle 
          cx="50" 
          cy="50" 
          r="44" 
          stroke={`url(#${gradId})`} 
          strokeWidth="3.5" 
          strokeDasharray="160 30 20 30"
          className={`hud-ring-${width}`}
          fill="rgba(10, 11, 16, 0.6)" 
        />
        
        {/* Circuit board traces */}
        <path 
          d="M22 50H34L42 58H58L66 42H78" 
          stroke="#00ffff" 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          filter={`url(#${glowFilterId})`}
        />
        
        <path 
          d="M26 40H36L42 32H58L64 48H74" 
          stroke={`url(#${gradId})`} 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          filter={`url(#${glowFilterId})`}
          opacity="0.75"
        />

        {/* Glowing trace end-points/nodes */}
        <circle cx="22" cy="50" r="4.5" fill="#00ffff" filter={`url(#${glowFilterId})`} />
        <circle cx="78" cy="50" r="4.5" fill="#6fb1fc" filter={`url(#${glowFilterId})`} />
        <circle cx="50" cy="42" r="5" fill="#00ffff" className={`glow-node-${width}`} filter={`url(#${glowFilterId})`} />
      </svg>
    </div>
  );
}

export default Logo;
