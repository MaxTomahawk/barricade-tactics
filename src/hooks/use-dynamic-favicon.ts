'use client';

import { useEffect } from 'react';

/**
 * Custom hook to dynamically update the browser's favicon based on a color.
 * Generates an SVG with the provided color and sets it as the favicon in the document head.
 * 
 * @param color - Hex color string (e.g., '#ef4444')
 */
export function useDynamicFavicon(color: string = '#ef4444') {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Generate the SVG string dynamically with the requested style and attributes
    const svgString = `<svg viewBox="-0.5 -0.5 1.0 1.0" xmlns="http://www.w3.org/2000/svg"><rect x="-0.45" y="-0.45" width="0.9" height="0.9" fill="none" rx="0.2" stroke="${color}" stroke-width="0.08"></rect><text x="0" y="0" font-family="sans-serif" font-size="0.45" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="central">BT</text></svg>`;
    
    // Encode the SVG string into a valid Data URI
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
    
    // Find or create the favicon link element
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    
    // Update the href attribute
    link.href = dataUri;
  }, [color]);
}
