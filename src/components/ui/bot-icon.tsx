'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface BotIconProps {
  color: string;
  className?: string;
}

/**
 * BotIcon component that renders a specific robot SVG.
 * 
 * Requirements met:
 * 1. Scaling: Uses width/height 1em to scale with surrounding text font-size.
 * 2. Dynamic Coloring: The outline uses the provided 'color' variable.
 * 3. Tinting: The inner fill uses a lighter tint of the same color via color-mix.
 */
export function BotIcon({ color, className }: BotIconProps) {
  return (
    <svg 
      viewBox="0 0 256 256" 
      id="Flat" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block align-middle shrink-0", className)}
      style={{ 
        width: '1em', 
        height: '1em',
        color: color 
      }}
      aria-label="Bot player"
    >
      <path 
        d="M200,56H56A23.99994,23.99994,0,0,0,32,80V192a23.99994,23.99994,0,0,0,24,24H200a23.99994,23.99994,0,0,0,24-24V80A23.99994,23.99994,0,0,0,200,56ZM164,184H92a20,20,0,0,1,0-40h72a20,20,0,0,1,0,40Z" 
        fill="currentColor"
        style={{ 
          // color-mix gives us a true lighter tint by mixing with white.
          // Fallback to simple opacity if current browser doesn't support color-mix.
          fill: `color-mix(in srgb, currentColor, white 40%)`,
          opacity: 0.8 // ensures visibility even without color-mix, though color-mix will override fill
        }}
      />
      <path 
        d="M200,48H136V16a8,8,0,0,0-16,0V48H56A32.03635,32.03635,0,0,0,24,80V192a32.03635,32.03635,0,0,0,32,32H200a32.03635,32.03635,0,0,0,32-32V80A32.03635,32.03635,0,0,0,200,48Zm16,144a16.01833,16.01833,0,0,1-16,16H56a16.01833,16.01833,0,0,1-16-16V80A16.01833,16.01833,0,0,1,56,64H200a16.01833,16.01833,0,0,1,16,16Zm-52-56H92a28,28,0,0,0,0,56h72a28,28,0,0,0,0-56Zm-24,16v24H116V152ZM80,164a12.01343,12.01343,0,0,1,12-12h8v24H92A12.01343,12.01343,0,0,1,80,164Zm84,12h-8V152h8a12,12,0,0,1,0,24ZM72,108a12,12,0,1,1,12,12A12,12,0,0,1,72,108Zm88,0a12,12,0,1,1,12,12A12,12,0,0,1,160,108Z" 
        fill="currentColor"
      />
    </svg>
  );
}
