'use client';

import { useEffect, useRef } from 'react';
import { siteConfig } from 'landing-app/config/site';

export default function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      drawGrid();
    };

    const drawGrid = () => {
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Parse the primary color to get RGB values
      const primaryColor = siteConfig.colors.primary;
      const r = Number.parseInt(primaryColor.slice(1, 3), 16);
      const g = Number.parseInt(primaryColor.slice(3, 5), 16);
      const b = Number.parseInt(primaryColor.slice(5, 7), 16);

      // Grid settings
      const gridSize = 40;
      const majorGridEvery = 5;
      const minorLineWidth = 0.5;
      const majorLineWidth = 1;

      // Calculate grid dimensions
      const width = window.innerWidth;
      const height = window.innerHeight;
      const cols = Math.floor(width / gridSize) + 2;
      const rows = Math.floor(height / gridSize) + 2;

      // Draw the grid
      ctx.beginPath();

      // Vertical lines
      for (let i = 0; i < cols; i++) {
        const x = i * gridSize;
        const isMajor = i % majorGridEvery === 0;

        ctx.lineWidth = isMajor ? majorLineWidth : minorLineWidth;
        ctx.strokeStyle = isMajor ? `rgba(${r}, ${g}, ${b}, 0.1)` : `rgba(${r}, ${g}, ${b}, 0.05)`;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let i = 0; i < rows; i++) {
        const y = i * gridSize;
        const isMajor = i % majorGridEvery === 0;

        ctx.lineWidth = isMajor ? majorLineWidth : minorLineWidth;
        ctx.strokeStyle = isMajor ? `rgba(${r}, ${g}, ${b}, 0.1)` : `rgba(${r}, ${g}, ${b}, 0.05)`;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 h-full w-full opacity-30" />;
}
