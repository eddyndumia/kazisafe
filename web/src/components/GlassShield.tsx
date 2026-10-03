// Glossy orange glass shield for the hero, our take on the reference's glass crystal.
export default function GlassShield() {
  return (
    <svg viewBox="0 0 420 460" width="100%" role="img" aria-label="Glass shield">
      <defs>
        <linearGradient id="body" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FFD2AE" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#FF8A3D" stopOpacity="0.85" />
          <stop offset="1" stopColor="#B83A06" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.15" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FF7A1A" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FF7A1A" stopOpacity="0" />
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>
      <ellipse cx="210" cy="250" rx="200" ry="200" fill="url(#glow)" />
      <g className="float" style={{ transformOrigin: '210px 230px' }}>
        <path d="M210 30 70 82v104c0 92 60 160 140 190 80-30 140-98 140-190V82L210 30z" fill="url(#body)" />
        <path d="M210 30 70 82v104c0 92 60 160 140 190V30z" fill="url(#face)" />
        <path d="M210 30 70 82v104c0 92 60 160 140 190 80-30 140-98 140-190V82L210 30z" fill="none" stroke="url(#edge)" strokeWidth="3" />
        <path d="M210 62 98 103v84c0 74 48 128 112 153 64-25 112-79 112-153v-84L210 62z" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
        <path d="M100 110c40-22 70-30 110-34" stroke="#fff" strokeOpacity="0.9" strokeWidth="6" strokeLinecap="round" fill="none" filter="url(#blur)" />
        <g transform="translate(210 205)">
          <rect x="-46" y="-6" width="92" height="74" rx="14" fill="#fff" fillOpacity="0.92" />
          <path d="M-28 -6v-20a28 28 0 0 1 56 0v20" fill="none" stroke="#fff" strokeOpacity="0.92" strokeWidth="12" strokeLinecap="round" />
          <circle cx="0" cy="24" r="9" fill="#E2500A" />
          <rect x="-3.5" y="26" width="7" height="22" rx="3.5" fill="#E2500A" />
        </g>
      </g>
    </svg>
  )
}
