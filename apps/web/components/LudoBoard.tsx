'use client';

import React, { useMemo } from 'react';
import type {
  GameState,
  PlayerColor,
  TokenState,
  TokenId,
} from '@ludo/shared-types';

interface LudoBoardProps {
  gameState: GameState;
  myColor?: PlayerColor;
  onTokenClick?: (tokenId: TokenId) => void;
  disabled?: boolean;
}

// 52 Main Track coordinates on a 15x15 grid [col, row]
const TRACK_COORDS: [number, number][] = [
  // Red start & outward arm (0..4)
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  // Up arm (5..10)
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  // Top crossover (11..12)
  [7, 0], [8, 0],
  // Down arm / Blue start (13..17)
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  // Right arm (18..23)
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  // Right crossover (24..25)
  [14, 7], [14, 8],
  // Left arm / Yellow start (26..30)
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  // Down arm (31..36)
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  // Bottom crossover (37..38)
  [7, 14], [6, 14],
  // Up arm / Green start (39..43)
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  // Left arm (44..49)
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  // Left crossover (50..51)
  [0, 7], [0, 6],
];

// Home runways: 5 steps each leading into center
const HOME_PATH_COORDS: Record<PlayerColor, [number, number][]> = {
  RED: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  BLUE: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  YELLOW: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  GREEN: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
};

// Yard pocket coordinates: Red top-left, Blue top-right, Yellow bottom-right, Green bottom-left
const YARD_POCKETS: Record<PlayerColor, [number, number][]> = {
  RED: [[1.9, 1.9], [3.9, 1.9], [1.9, 3.9], [3.9, 3.9]],
  BLUE: [[10.9, 1.9], [12.9, 1.9], [10.9, 3.9], [12.9, 3.9]],
  YELLOW: [[10.9, 10.9], [12.9, 10.9], [10.9, 12.9], [12.9, 12.9]],
  GREEN: [[1.9, 10.9], [3.9, 10.9], [1.9, 12.9], [3.9, 12.9]],
};

// Color styling constants
const COLOR_CONFIG: Record<
  PlayerColor,
  { main: string; dark: string; light: string; border: string; glow: string }
> = {
  RED: { main: '#e11d48', dark: '#9f1239', light: '#fecdd3', border: '#be123c', glow: '#fb7185' },
  BLUE: { main: '#0284c7', dark: '#075985', light: '#bae6fd', border: '#0369a1', glow: '#38bdf8' },
  YELLOW: { main: '#eab308', dark: '#a16207', light: '#fef08a', border: '#ca8a04', glow: '#facc15' },
  GREEN: { main: '#16a34a', dark: '#14532d', light: '#bbf7d0', border: '#15803d', glow: '#4ade80' },
};

// Star badge configuration: matching user's board image
// Red start (0) & safe (47); Blue start (13) & safe (8); Yellow start (26) & safe (21); Green start (39) & safe (34)
const STAR_BADGES: Record<number, PlayerColor> = {
  0: 'RED',
  47: 'RED',
  13: 'BLUE',
  8: 'BLUE',
  26: 'YELLOW',
  21: 'YELLOW',
  39: 'GREEN',
  34: 'GREEN',
};

// Colored runway entry cells (corner track turns into runway)
const RUNWAY_ENTRIES: Record<number, PlayerColor> = {
  51: 'RED',    // [0, 6]
  12: 'BLUE',   // [8, 0]
  25: 'YELLOW', // [14, 8]
  38: 'GREEN',  // [6, 14]
};

export const LudoBoard: React.FC<LudoBoardProps> = ({
  gameState,
  myColor,
  onTokenClick,
  disabled = false,
}) => {
  // Determine which tokens can be legally moved by the user right now
  const legalTokenIds = useMemo(() => {
    if (!myColor || gameState.currentTurnColor !== myColor || disabled) {
      return new Set<TokenId>();
    }
    return new Set(gameState.legalMoves.map((m) => m.tokenId));
  }, [gameState.legalMoves, gameState.currentTurnColor, myColor, disabled]);

  // Compute exact coordinates for all tokens with stacking offsets
  const renderedTokens = useMemo(() => {
    const list: Array<{
      token: TokenState;
      col: number;
      row: number;
      isLegal: boolean;
      stackIndex: number;
      stackTotal: number;
    }> = [];

    const cellGroups = new Map<string, TokenState[]>();

    for (const color of ['RED', 'BLUE', 'YELLOW', 'GREEN'] as PlayerColor[]) {
      const player = gameState.players[color];
      if (!player) continue;

      for (const token of player.tokens) {
        let key = '';
        if (token.positionType === 'YARD') {
          key = `YARD_${color}_${token.step}`;
        } else if (token.positionType === 'MAIN_TRACK') {
          key = `MAIN_${token.step}`;
        } else if (token.positionType === 'HOME_PATH') {
          key = `HOME_${color}_${token.step}`;
        } else if (token.positionType === 'HOME_FINAL') {
          key = `FINAL_${color}`;
        }

        const existing = cellGroups.get(key) || [];
        existing.push(token);
        cellGroups.set(key, existing);
      }
    }

    cellGroups.forEach((tokens) => {
      const total = tokens.length;
      tokens.forEach((token, index) => {
        let col = 0;
        let row = 0;

        if (token.positionType === 'YARD') {
          const pocket = YARD_POCKETS[token.color][token.step] || [2, 2];
          col = pocket[0];
          row = pocket[1];
        } else if (token.positionType === 'MAIN_TRACK') {
          const coord = TRACK_COORDS[token.step];
          col = coord[0] + 0.5;
          row = coord[1] + 0.5;
        } else if (token.positionType === 'HOME_PATH') {
          const coord = HOME_PATH_COORDS[token.color][token.step];
          col = coord[0] + 0.5;
          row = coord[1] + 0.5;
        } else if (token.positionType === 'HOME_FINAL') {
          const center = 7.5;
          const offsets: Record<PlayerColor, [number, number]> = {
            RED: [-0.65, 0],
            BLUE: [0, -0.65],
            YELLOW: [0.65, 0],
            GREEN: [0, 0.65],
          };
          col = center + offsets[token.color][0];
          row = center + offsets[token.color][1];
        }

        const isLegal = token.color === myColor && legalTokenIds.has(token.id);

        list.push({
          token,
          col,
          row,
          isLegal,
          stackIndex: index,
          stackTotal: total,
        });
      });
    });

    return list;
  }, [gameState.players, myColor, legalTokenIds]);

  return (
    <div className="relative w-full max-w-[540px] aspect-square rounded-[36px] shadow-2xl p-2 sm:p-3 bg-gradient-to-br from-amber-700 via-amber-900 to-yellow-950 border-4 border-amber-500/80 select-none">
      <svg
        viewBox="0 0 1500 1500"
        className="w-full h-full rounded-[28px] overflow-hidden"
        style={{ touchAction: 'manipulation' }}
      >
        <defs>
          {/* Metallic Gold Outer Bevel Gradient */}
          <linearGradient id="goldFrame" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="25%" stopColor="#eab308" />
            <stop offset="50%" stopColor="#854d0e" />
            <stop offset="75%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#713f12" />
          </linearGradient>

          {/* Gentle floating halo for selectable active token */}
          <filter id="tokenFloatingHalo" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#f59e0b" floodOpacity="0.95" />
            <feDropShadow dx="0" dy="0" stdDeviation="24" floodColor="#fbbf24" floodOpacity="0.6" />
          </filter>

          {/* Token 3D Shadow */}
          <filter id="tokenDepthShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* 1. Base pure white board background */}
        <rect x="0" y="0" width="1500" height="1500" fill="#ffffff" />

        {/* 2. Main Track 52 squares (Crisp pure white, clean dark borders) */}
        {TRACK_COORDS.map(([c, r], index) => {
          const x = c * 100;
          const y = r * 100;

          // Check if this cell is a colored runway turn entry
          const runwayColor = RUNWAY_ENTRIES[index];
          const starColor = STAR_BADGES[index];

          let cellFill = '#ffffff';
          if (runwayColor) {
            cellFill = COLOR_CONFIG[runwayColor].main;
          }

          return (
            <g key={`cell-${index}`}>
              <rect
                x={x + 1}
                y={y + 1}
                width={98}
                height={98}
                fill={cellFill}
                stroke="#1e293b"
                strokeWidth={2}
              />

              {/* Star Badge for Start / Safe Squares */}
              {starColor && (
                <g>
                  {/* Colored circular badge */}
                  <circle
                    cx={x + 50}
                    cy={y + 50}
                    r={32}
                    fill={COLOR_CONFIG[starColor].main}
                    stroke="#ffffff"
                    strokeWidth={3}
                  />
                  {/* Crisp white star inside */}
                  <path
                    d={`M ${x + 50} ${y + 28} L ${x + 56} ${y + 43} L ${x + 72} ${y + 44} L ${x + 59} ${y + 54} L ${x + 64} ${y + 70} L ${x + 50} ${y + 59} L ${x + 36} ${y + 70} L ${x + 41} ${y + 54} L ${x + 28} ${y + 44} L ${x + 44} ${y + 43} Z`}
                    fill="#ffffff"
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* 3. Home Runways (5 steps each leading into center) */}
        {(['RED', 'BLUE', 'YELLOW', 'GREEN'] as PlayerColor[]).map((color) =>
          HOME_PATH_COORDS[color].map(([c, r], i) => (
            <rect
              key={`home-${color}-${i}`}
              x={c * 100 + 1}
              y={r * 100 + 1}
              width={98}
              height={98}
              fill={COLOR_CONFIG[color].main}
              stroke="#1e293b"
              strokeWidth={2}
            />
          ))
        )}

        {/* 4. Four Corner Yards: Red top-left, Blue top-right, Yellow bottom-right, Green bottom-left */}
        {/* RED Yard: Top Left (0..6, 0..6) */}
        <g id="yard-red">
          <rect x={0} y={0} width={600} height={600} fill={COLOR_CONFIG.RED.main} stroke="#1e293b" strokeWidth={3} />
          {/* Inner rounded white box */}
          <rect x={75} y={75} width={450} height={450} rx={48} fill="#ffffff" stroke="#1e293b" strokeWidth={4} />
          {/* 4 large circular red pockets */}
          {YARD_POCKETS.RED.map(([cx, cy], i) => (
            <g key={`rp-${i}`}>
              <circle
                cx={cx * 100}
                cy={cy * 100}
                r={44}
                fill={COLOR_CONFIG.RED.main}
                stroke="#1e293b"
                strokeWidth={4}
              />
            </g>
          ))}
        </g>

        {/* BLUE Yard: Top Right (9..15, 0..6) */}
        <g id="yard-blue">
          <rect x={900} y={0} width={600} height={600} fill={COLOR_CONFIG.BLUE.main} stroke="#1e293b" strokeWidth={3} />
          {/* Inner rounded white box */}
          <rect x={975} y={75} width={450} height={450} rx={48} fill="#ffffff" stroke="#1e293b" strokeWidth={4} />
          {/* 4 large circular blue pockets */}
          {YARD_POCKETS.BLUE.map(([cx, cy], i) => (
            <g key={`bp-${i}`}>
              <circle
                cx={cx * 100}
                cy={cy * 100}
                r={44}
                fill={COLOR_CONFIG.BLUE.main}
                stroke="#1e293b"
                strokeWidth={4}
              />
            </g>
          ))}
        </g>

        {/* YELLOW Yard: Bottom Right (9..15, 9..15) */}
        <g id="yard-yellow">
          <rect x={900} y={900} width={600} height={600} fill={COLOR_CONFIG.YELLOW.main} stroke="#1e293b" strokeWidth={3} />
          {/* Inner rounded white box */}
          <rect x={975} y={975} width={450} height={450} rx={48} fill="#ffffff" stroke="#1e293b" strokeWidth={4} />
          {/* 4 large circular yellow pockets */}
          {YARD_POCKETS.YELLOW.map(([cx, cy], i) => (
            <g key={`yp-${i}`}>
              <circle
                cx={cx * 100}
                cy={cy * 100}
                r={44}
                fill={COLOR_CONFIG.YELLOW.main}
                stroke="#1e293b"
                strokeWidth={4}
              />
            </g>
          ))}
        </g>

        {/* GREEN Yard: Bottom Left (0..6, 9..15) */}
        <g id="yard-green">
          <rect x={0} y={900} width={600} height={600} fill={COLOR_CONFIG.GREEN.main} stroke="#1e293b" strokeWidth={3} />
          {/* Inner rounded white box */}
          <rect x={75} y={975} width={450} height={450} rx={48} fill="#ffffff" stroke="#1e293b" strokeWidth={4} />
          {/* 4 large circular green pockets */}
          {YARD_POCKETS.GREEN.map(([cx, cy], i) => (
            <g key={`gp-${i}`}>
              <circle
                cx={cx * 100}
                cy={cy * 100}
                r={44}
                fill={COLOR_CONFIG.GREEN.main}
                stroke="#1e293b"
                strokeWidth={4}
              />
            </g>
          ))}
        </g>

        {/* 5. Center Home Triangular Destination */}
        <g id="center-home">
          {/* Red Left Triangle */}
          <polygon
            points="600,600 750,750 600,900"
            fill={COLOR_CONFIG.RED.main}
            stroke="#1e293b"
            strokeWidth={3}
          />
          {/* Blue Top Triangle */}
          <polygon
            points="600,600 900,600 750,750"
            fill={COLOR_CONFIG.BLUE.main}
            stroke="#1e293b"
            strokeWidth={3}
          />
          {/* Yellow Right Triangle */}
          <polygon
            points="900,600 900,900 750,750"
            fill={COLOR_CONFIG.YELLOW.main}
            stroke="#1e293b"
            strokeWidth={3}
          />
          {/* Green Bottom Triangle */}
          <polygon
            points="600,900 750,750 900,900"
            fill={COLOR_CONFIG.GREEN.main}
            stroke="#1e293b"
            strokeWidth={3}
          />
        </g>

        {/* 6. Outer Beveled Gold Metallic Border */}
        <rect
          x="10"
          y="10"
          width="1480"
          height="1480"
          rx="50"
          fill="none"
          stroke="url(#goldFrame)"
          strokeWidth="20"
        />

        {/* 7. Rendered Interactive Tokens */}
        {renderedTokens.map(({ token, col, row, isLegal, stackIndex, stackTotal }) => {
          let offsetX = 0;
          let offsetY = 0;
          if (stackTotal > 1) {
            const angle = (stackIndex / stackTotal) * 2 * Math.PI;
            const radius = 18;
            offsetX = Math.cos(angle) * radius;
            offsetY = Math.sin(angle) * radius;
          }

          // Fixed stationary coordinates: never moves on hover/active to allow instant 1-tap selection
          const cx = col * 100 + offsetX;
          const cy = row * 100 + offsetY;
          const colorStyles = COLOR_CONFIG[token.color];

          return (
            <g
              key={`tok-${token.color}-${token.id}`}
              className={isLegal ? 'selectable-token' : ''}
              onClick={() => {
                if (isLegal && onTokenClick) {
                  onTokenClick(token.id);
                }
              }}
              style={{
                cursor: isLegal ? 'pointer' : 'default',
                transition: 'opacity 0.2s ease',
              }}
            >
              {/* Floating stationary halo ring when token is legal */}
              {isLegal && (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={36}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={5}
                    strokeDasharray="6 3"
                    filter="url(#tokenFloatingHalo)"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={32}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={2}
                    opacity={0.8}
                  />
                </>
              )}

              {/* Main Token Base */}
              <circle
                cx={cx}
                cy={cy}
                r={28}
                fill={colorStyles.main}
                stroke={isLegal ? '#ffffff' : '#1e293b'}
                strokeWidth={isLegal ? 4 : 3}
                filter="url(#tokenDepthShadow)"
              />

              {/* Inner Gloss Ring */}
              <circle
                cx={cx}
                cy={cy}
                r={19}
                fill={colorStyles.light}
                opacity={0.55}
              />

              {/* Token Number Label (1..4) */}
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="19"
                fontWeight="900"
                style={{
                  pointerEvents: 'none',
                  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                }}
              >
                {token.id + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
