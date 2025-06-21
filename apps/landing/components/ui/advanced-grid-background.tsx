"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export default function AdvancedGridBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { theme } = useTheme();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;
		let mouseX = 0;
		let mouseY = 0;

		const resizeCanvas = () => {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = window.innerWidth * dpr;
			canvas.height = window.innerHeight * dpr;
			ctx.scale(dpr, dpr);
			canvas.style.width = `${window.innerWidth}px`;
			canvas.style.height = `${window.innerHeight}px`;
		};

		const handleMouseMove = (e: MouseEvent) => {
			mouseX = e.clientX;
			mouseY = e.clientY;
		};

		const drawGrid = () => {
			if (!ctx) return;

			ctx.clearRect(0, 0, canvas.width, canvas.height);

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

			// Get colors based on theme
			const primaryColor =
				theme === "dark" ? "rgba(180, 255, 255, " : "rgba(15, 118, 110, ";
			const secondaryColor =
				theme === "dark" ? "rgba(255, 180, 120, " : "rgba(249, 115, 22, ";

			// Calculate distance from mouse for glow effect
			const maxDistance = 300;

			// Draw the grid
			// Vertical lines
			for (let i = 0; i < cols; i++) {
				const x = i * gridSize;
				const isMajor = i % majorGridEvery === 0;

				// Calculate distance from mouse for this line
				const distanceX = Math.abs(mouseX - x);
				const glowIntensity = Math.max(0, 1 - distanceX / maxDistance);

				ctx.lineWidth = isMajor ? majorLineWidth : minorLineWidth;

				// Use different colors for major/minor lines with glow effect
				if (isMajor) {
					ctx.strokeStyle = `${primaryColor}${0.1 + glowIntensity * 0.3})`;
				} else {
					ctx.strokeStyle = `${primaryColor}${0.05 + glowIntensity * 0.15})`;
				}

				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, height);
				ctx.stroke();
			}

			// Horizontal lines
			for (let i = 0; i < rows; i++) {
				const y = i * gridSize;
				const isMajor = i % majorGridEvery === 0;

				// Calculate distance from mouse for this line
				const distanceY = Math.abs(mouseY - y);
				const glowIntensity = Math.max(0, 1 - distanceY / maxDistance);

				ctx.lineWidth = isMajor ? majorLineWidth : minorLineWidth;

				// Use different colors for major/minor lines with glow effect
				if (isMajor) {
					ctx.strokeStyle = `${secondaryColor}${0.1 + glowIntensity * 0.3})`;
				} else {
					ctx.strokeStyle = `${secondaryColor}${0.05 + glowIntensity * 0.15})`;
				}

				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(width, y);
				ctx.stroke();
			}

			// Draw intersection points with glow
			for (let i = 0; i < cols; i++) {
				for (let j = 0; j < rows; j++) {
					const x = i * gridSize;
					const y = j * gridSize;
					const isMajorX = i % majorGridEvery === 0;
					const isMajorY = j % majorGridEvery === 0;

					if (isMajorX && isMajorY) {
						// Calculate distance from mouse
						const dx = mouseX - x;
						const dy = mouseY - y;
						const distance = Math.sqrt(dx * dx + dy * dy);
						const glowIntensity = Math.max(0, 1 - distance / maxDistance);

						// Draw glowing dot at intersection
						const gradient = ctx.createRadialGradient(
							x,
							y,
							0,
							x,
							y,
							5 + glowIntensity * 10,
						);
						gradient.addColorStop(
							0,
							`rgba(255, 255, 255, ${0.3 + glowIntensity * 0.7})`,
						);
						gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

						ctx.fillStyle = gradient;
						ctx.beginPath();
						ctx.arc(x, y, 5 + glowIntensity * 10, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}

			animationFrameId = requestAnimationFrame(drawGrid);
		};

		resizeCanvas();
		window.addEventListener("resize", resizeCanvas);
		window.addEventListener("mousemove", handleMouseMove);

		drawGrid();

		return () => {
			window.removeEventListener("resize", resizeCanvas);
			window.removeEventListener("mousemove", handleMouseMove);
			cancelAnimationFrame(animationFrameId);
		};
	}, [theme]);

	return (
		<canvas
			ref={canvasRef}
			className="fixed inset-0 -z-10 h-full w-full opacity-30"
		/>
	);
}
