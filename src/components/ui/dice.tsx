'use client';

import React, { useState, useEffect } from 'react';

export const DICE_PIPS: Record<number, number[][]> = {
  1: [[0, 0]],
  2: [[-0.22, -0.22], [0.22, 0.22]],
  3: [[-0.22, -0.22], [0, 0], [0.22, 0.22]],
  4: [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]],
  5: [[-0.22, -0.22], [0.22, -0.22], [0, 0], [-0.22, 0.22], [0.22, 0.22]],
  6: [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0], [0.22, 0], [-0.22, 0.22], [0.22, 0.22]],
};

export function DiceDots({ value, color, size }: { value: number; color: string; size: number }) {
  const pips = DICE_PIPS[value] || DICE_PIPS[1];
  const dotR = size * 0.1;
  return (
    <>
      {pips.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={dotR} fill={color} />
      ))}
    </>
  );
}

export function RollingDice({ color, diceMode, size = 12 }: { color: string; diceMode: string; size?: number }) {
  const [face, setFace] = useState(1);
  
  useEffect(() => {
    if (diceMode === 'instant' || diceMode === 'instant_bots') {
      setFace(Math.floor(Math.random() * 6) + 1);
      return;
    }
    const interval = setInterval(() => {
      setFace(Math.floor(Math.random() * 6) + 1);
    }, 80);
    return () => clearInterval(interval);
  }, [diceMode]);
  
  return (
    <svg viewBox="-0.5 -0.5 1.0 1.0" className="animate-spin" style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem`, animationDuration: '0.6s' }}>
      <rect x={-0.45} y={-0.45} width={0.9} height={0.9} fill="#0f172a" rx={0.2} stroke={color} strokeWidth={0.08} />
      <DiceDots value={face} color={color} size={0.8} />
    </svg>
  );
}

export function StaticDice({ value, color, size = 6, showQuestion = false }: { value: number; color: string; size?: number; showQuestion?: boolean }) {
    return (
        <svg viewBox="-0.5 -0.5 1.0 1.0" style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }}>
            <rect x={-0.45} y={-0.45} width={0.9} height={0.9} fill="#0f172a" rx={0.2} stroke={color} strokeWidth={0.08} />
            {showQuestion ? (
              <text x="0" y="0.25" fontSize="0.7" fontWeight="black" textAnchor="middle" fill={color} style={{ pointerEvents: 'none' }}>?</text>
            ) : (
              <DiceDots value={value} color={color} size={0.8} />
            )}
        </svg>
    )
}
