'use client';

import React, { useMemo } from 'react';
import type {
  GameState,
  PlayerColor,
  TokenState,
  TokenId,
  LegalMove,
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
  // Down arm / Green start (13..17)
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
  // Up arm / Blue start (39..43)
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  // Left arm (44..49)
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  // Left crossover (50..51)
  [0, 7], [0, 6],
];

// Home runways: 5 steps each leading into center
const HOME_PATH_COORDS: Record<PlayerColor, [number, number][]> = {
  RED: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  GREEN: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  YELLOW: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  BLUE: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
};

// Yard pocket coordinates
const YARD_POCKETS: Record<PlayerColor, [number, number][]> = {
  RED: [[1.8, 1.8], [3.8, 1.8], [1.8, 3.8], [3.8, 3.8]],
  GREEN: [[10.8, 1.8], [12.8, 1.8], [10.8, 3.8], [12.8, 3.8]],
  YELLOW: [[10.8, 10.8], [12.8, 10.8], [10.8, 12.8], [12.8, 12.8]],
  BLUE: [[1.8, 10.8], [3.8, 10.8], [1.8, 12.8], [3.8, 12.8]],
};

// Safe squares set
const SAFE_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const COLOR_FILLS: Record<PlayerColor, { main: string; light: string; border: string }> = {
  RED: { main: '#ef4444', light: '#fca5a5', border: '#b91c1c' },
  GREEN: { main: '#10b981', light: '#86efac', border: '#047857' },
  YELLOW: { main: '#f59e0b', light: '#fde68a', border: '#b45309' },
  BLUE: { main: '#3b82f6', light: '#93c5fd', border: '#1d4ed8' },
};

export const LudoBoard: React.FC<LudoBoardProps> = ({
  gameState,
  myColor,
  onTokenClick,
  disabled = false,
}) => {
  const cellSize = 100 / 15; // percentage per cell (6.666%)

  // Check which tokens are legal for the current player
  const legalTokenIds = useMemo(() => {
    if (!myColor || gameState.currentTurnColor !== myColor || disabled) {
      return new Set<TokenId>();
    }
    return new Set(gameState.legalMoves.map((m) => m.tokenId));
  }, [gameState.legalMoves, gameState.currentTurnColor, myColor, disabled]);

  // Collect all tokens with rendered board coordinates
  const renderedTokens = useMemo(() => {
    const list: Array<{
      token: TokenState;
      col: number;
      row: number;
      isLegal: boolean;
      stackIndex: number;
      stackTotal: number;
    }> = [];

    // Grouping map for stacking multiple tokens on the same square
    const cellGroups = new Map<string, TokenState[]>();

    for (const color of ['RED', 'GREEN', 'YELLOW', 'BLUE'] as PlayerColor[]) {
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

    cellGroups.forEach((tokens, key) => {
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
          // Center home area offset by color
          const center = 7.5;
          const offsets: Record<PlayerColor, [number, number]> = {
            RED: [-0.6, 0],
            GREEN: [0, -0.6],
            YELLOW: [0.6, 0],
            BLUE: [0, 0.6],
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
    <div className="relative w-full max-w-[560px] aspect-square rounded-2xl shadow-2xl overflow-hidden p-2 bg-slate-900 border-2 border-slate-800 select-none">
      <svg
        viewBox="0 0 1500 1500"
        className="w-full h-full rounded-xl bg-slate-950"
        style={{ touchAction: 'manipulation' }}
      >
        <defs>
          {/* Subtle drop shadow filters for tokens */}
          <filter id="tokenGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="15" floodColor="#fbbf24" floodOpacity="0.8" />
          </filter>
          <filter id="tokenShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* 1. Base grid lines and track cells */}
        {TRACK_COORDS.map(([c, r], index) => {
          const x = c * 100;
          const y = r * 100;
          const isSafe = SAFE_INDICES.has(index);

          let cellFill = '#1e293b'; // Default track square
          if (index === 0) cellFill = '#ef4444'; // Red start
          else if (index === 13) cellFill = '#10b981'; // Green start
          else if (index === 26) cellFill = '#f59e0b'; // Yellow start
          else if (index === 39) cellFill = '#3b82f6'; // Blue start

          return (
            <g key={`track-${index}`}>
              <rect
                x={x + 2}
                y={y + 2}
                width={96}
                height={96}
                rx={6}
                fill={cellFill}
                stroke="#334155"
                strokeWidth={2}
              />
              {isSafe && (
                <path
                  d={`M ${x + 50} ${y + 25} L ${x + 58} ${y + 42} L ${x + 75} ${y + 43} L ${x + 62} ${y + 55} L ${x + 67} ${y + 72} L ${x + 50} ${y + 60} L ${x + 33} ${y + 72} L ${x + 38} ${y + 55} L ${x + 25} ${y + 43} L ${x + 42} ${y + 42} Z`}
                  fill="#fbbf24"
                  stroke="#d97706"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}

        {/* 2. Home Runways (5 cells each) */}
        {(['RED', 'GREEN', 'YELLOW', 'BLUE'] as PlayerColor[]).map((color) =>
          HOME_PATH_COORDS[color].map(([c, r], i) => (
            <rect
              key={`home-${color}-${i}`}
              x={c * 100 + 2}
              y={r * 100 + 2}
              width={96}
              height={96}
              rx={6}
              fill={COLOR_FILLS[color].main}
              stroke="#0f172a"
              strokeWidth={2}
            />
          ))
        )}

        {/* 3. Yards (Four large corner boxes) */}
        {/* Red Yard: Top Left (0..5, 0..5) */}
        <g id="red-yard">
          <rect x={10} y={10} width={580} height={580} rx={16} fill="#ef4444" stroke="#991b1b" strokeWidth={4} />
          <rect x={80} y={80} width={440} height={440} rx={24} fill="#ffffff" />
          {YARD_POCKETS.RED.map(([cx, cy], i) => (
            <circle
              key={`rp-${i}`}
              cx={cx * 100}
              cy={cy * 100}
              r={40}
              fill="#fee2e2"
              stroke="#ef4444"
              strokeWidth={6}
            />
          ))}
        </g>

        {/* Green Yard: Top Right (9..14, 0..5) */}
        <g id="green-yard">
          <rect x={910} y={10} width={580} height={580} rx={16} fill="#10b981" stroke="#065f46" strokeWidth={4} />
          <rect x={980} y={80} width={440} height={440} rx={24} fill="#ffffff" />
          {YARD_POCKETS.GREEN.map(([cx, cy], i) => (
            <circle
              key={`gp-${i}`}
              cx={cx * 100}
              cy={cy * 100}
              r={40}
              fill="#d1fae5"
              stroke="#10b981"
              strokeWidth={6}
            />
          ))}
        </g>

        {/* Yellow Yard: Bottom Right (9..14, 9..14) */}
        <g id="yellow-yard">
          <rect x={910} y={910} width={580} height={580} rx={16} fill="#f59e0b" stroke="#92400e" strokeWidth={4} />
          <rect x={980} y={980} width={440} height={440} rx={24} fill="#ffffff" />
          {YARD_POCKETS.YELLOW.map(([cx, cy], i) => (
            <circle
              key={`yp-${i}`}
              cx={cx * 100}
              cy={cy * 100}
              r={40}
              fill="#fef3c7"
              stroke="#f59e0b"
              strokeWidth={6}
            />
          ))}
        </g>

        {/* Blue Yard: Bottom Left (0..5, 9..14) */}
        <g id="blue-yard">
          <rect x={10} y={910} width={580} height={580} rx={16} fill="#3b82f6" stroke="#1e40af" strokeWidth={4} />
          <rect x={80} y={980} width={440} height={440} rx={24} fill="#ffffff" />
          {YARD_POCKETS.BLUE.map(([cx, cy], i) => (
            <circle
              key={`bp-${i}`}
              cx={cx * 100}
              cy={cy * 100}
              r={40}
              fill="#dbeafe"
              stroke="#3b82f6"
              strokeWidth={6}
            />
          ))}
        </g>

        {/* 4. Center Home Triangle Area (6..8, 6..8) */}
        <g id="center-home">
          <rect x={600} y={600} width={300} height={300} fill="#0f172a" />
          {/* Red triangle (left) */}
          <polygon points="600,600 750,750 600,900" fill="#ef4444" stroke="#0f172a" strokeWidth={2} />
          {/* Green triangle (top) */}
          <polygon points="600,600 900,600 750,750" fill="#10b981" stroke="#0f172a" strokeWidth={2} />
          {/* Yellow triangle (right) */}
          <polygon points="900,600 900,900 750,750" fill="#f59e0b" stroke="#0f172a" strokeWidth={2} />
          {/* Blue triangle (bottom) */}
          <polygon points="600,900 750,750 900,900" fill="#3b82f6" stroke="#0f172a" strokeWidth={2} />

          {/* Center decorative gold emblem */}
          <circle cx={750} cy={750} r={32} fill="#0f172a" stroke="#fbbf24" strokeWidth={3} />
          <text
            x={750}
            y={756}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fbbf24"
            fontSize="20"
            fontWeight="bold"
          >
            ★
          </text>
        </g>

        {/* 5. Rendered Interactive Tokens */}
        {renderedTokens.map(({ token, col, row, isLegal, stackIndex, stackTotal }) => {
          // Compute subtle micro-offset if multiple tokens share the square
          let offsetX = 0;
          let offsetY = 0;
          if (stackTotal > 1) {
            const angle = (stackIndex / stackTotal) * 2 * Math.PI;
            const radius = 16;
            offsetX = Math.cos(angle) * radius;
            offsetY = Math.sin(angle) * radius;
          }

          const cx = col * 100 + offsetX;
          const cy = row * 100 + offsetY;
          const colorStyles = COLOR_FILLS[token.color];

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
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              {/* Highlight halo when token can move */}
              {isLegal && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={38}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={6}
                  strokeDasharray="6 4"
                  filter="url(#tokenGlow)"
                />
              )}

              {/* Main token body */}
              <circle
                cx={cx}
                cy={cy}
                r={28}
                fill={colorStyles.main}
                stroke={isLegal ? '#ffffff' : colorStyles.border}
                strokeWidth={isLegal ? 4 : 3}
                filter="url(#tokenShadow)"
              />

              {/* Inner highlight ring */}
              <circle cx={cx} cy={cy} r={18} fill={colorStyles.light} opacity={0.6} />

              {/* Token ID label (1..4) */}
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="18"
                fontWeight="900"
                style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
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
