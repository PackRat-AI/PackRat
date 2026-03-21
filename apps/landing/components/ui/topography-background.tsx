'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function TopographyBackground() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [svgData, setSvgData] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Create different SVG patterns based on theme
    const color = theme === 'dark' ? '#ffffff' : '#000000';
    const opacity = theme === 'dark' ? '0.025' : '0.015';

    // Much subtler topography pattern SVG
    const svg = `
      <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="topo-pattern" x="0" y="0" width="1000" height="1000" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="${color}" strokeWidth="0.5" strokeOpacity="${opacity}">
              ${Array.from({ length: 40 })
                .map((_, i) => {
                  const y = i * 25;
                  return `
                  <path d="M0,${y + Math.sin(i * 0.2) * 15} 
                          C${250},${y + Math.sin(i * 0.2 + 1) * 10} 
                          ${500},${y + Math.sin(i * 0.2 + 2) * 15} 
                          ${750},${y + Math.sin(i * 0.2 + 3) * 10} 
                          ${1000},${y + Math.sin(i * 0.2 + 4) * 15}" />
                `;
                })
                .join('')}
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#topo-pattern)" />
      </svg>
    `;

    // Convert SVG to base64 for use in CSS
    setSvgData(btoa(svg));
  }, [theme, mounted]);

  if (!mounted || !svgData) {
    return null;
  }

  return null;

  // return (
  //   <div
  //     className="fixed inset-0 -z-10 h-full w-full opacity-60"
  //     style={{
  //       backgroundImage: `url('data:image/svg+xml;base64,${svgData}')`,
  //       backgroundSize: 'cover',
  //       backgroundPosition: 'center',
  //     }}
  //   />
  // );
}
