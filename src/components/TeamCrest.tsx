import React from 'react';
import { TeamId } from '../types/game';

interface TeamCrestProps {
  team: TeamId;
  size?: number;
  className?: string;
}

export const TeamCrest: React.FC<TeamCrestProps> = ({
  team,
  size = 56,
  className = '',
}) => {
  if (team === 'madrid') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 116"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Real Madrid Crest"
      >
        {/* Royal Crown */}
        <path
          d="M28 24L34 10L44 18L50 6L56 18L66 10L72 24H28Z"
          fill="#D4AF37"
          stroke="#927115"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect x="27" y="24" width="46" height="6" rx="2" fill="#B91C1C" stroke="#D4AF37" strokeWidth="1.5" />
        {/* Outer Gold Ring */}
        <circle cx="50" cy="68" r="38" fill="#F8FAFC" stroke="#D4AF37" strokeWidth="6" />
        <circle cx="50" cy="68" r="32" stroke="#1E3A8A" strokeWidth="2.5" />
        {/* Diagonal Royal Sash */}
        <clipPath id="madrid-clip">
          <circle cx="50" cy="68" r="30.5" />
        </clipPath>
        <g clipPath="url(#madrid-clip)">
          <path d="M18 88L74 32L86 44L30 100Z" fill="#1D4ED8" />
          {/* Monogram */}
          <text
            x="50"
            y="77"
            textAnchor="middle"
            fill="#0F172A"
            fontSize="26"
            fontWeight="800"
            fontFamily="Barlow Condensed, sans-serif"
            letterSpacing="1"
          >
            MCF
          </text>
        </g>
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FC Barcelona Crest"
    >
      {/* Classic Shield Outline */}
      <path
        d="M14 14H86V62C86 84 68 98 50 108C32 98 14 84 14 62V14Z"
        fill="#EDBB00"
        stroke="#B48900"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <clipPath id="barca-clip">
        <path d="M19 19H81V60C81 79 65 92 50 101C35 92 19 79 19 60V19Z" />
      </clipPath>
      <g clipPath="url(#barca-clip)">
        {/* Top-left Cross */}
        <rect x="19" y="19" width="31" height="30" fill="#F8FAFC" />
        <rect x="31" y="19" width="7" height="30" fill="#DC2626" />
        <rect x="19" y="30.5" width="31" height="7" fill="#DC2626" />
        {/* Top-right Gold & Red Stripes */}
        <rect x="50" y="19" width="31" height="30" fill="#FACC15" />
        <rect x="55" y="19" width="5" height="30" fill="#DC2626" />
        <rect x="65" y="19" width="5" height="30" fill="#DC2626" />
        <rect x="75" y="19" width="5" height="30" fill="#DC2626" />
        {/* Center Gold Ribbon */}
        <rect x="19" y="49" width="62" height="13" fill="#EDBB00" />
        <text
          x="50"
          y="59.5"
          textAnchor="middle"
          fill="#0F172A"
          fontSize="12"
          fontWeight="800"
          fontFamily="Barlow Condensed, sans-serif"
          letterSpacing="1.5"
        >
          FCB
        </text>
        {/* Bottom Blaugrana Stripes */}
        <rect x="19" y="62" width="12.4" height="40" fill="#004D98" />
        <rect x="31.4" y="62" width="12.4" height="40" fill="#A50044" />
        <rect x="43.8" y="62" width="12.4" height="40" fill="#004D98" />
        <rect x="56.2" y="62" width="12.4" height="40" fill="#A50044" />
        <rect x="68.6" y="62" width="12.4" height="40" fill="#004D98" />
        {/* Football emblem */}
        <circle cx="50" cy="81" r="8" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.5" />
      </g>
    </svg>
  );
};
