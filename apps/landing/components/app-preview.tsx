"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export default function AppPreview() {
	const [currentScreen, setCurrentScreen] = useState(0);
	const screens = [
		{
			src: "/trail-prep.png",
			alt: "Packing list screen",
		},
		{
			src: "/trail-map-minimal.png",
			alt: "Trail map screen",
		},
		{
			src: "/hiking-app-weather.png",
			alt: "Weather screen",
		},
	];

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentScreen((prev) => (prev + 1) % screens.length);
		}, 3000);
		return () => clearInterval(interval);
	}, [screens.length]);

	return (
		<>
			<AnimatePresence mode="wait">
				<motion.div
					key={currentScreen}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.5 }}
					className="absolute inset-0"
				>
					<Image
						src={screens[currentScreen].src || "/placeholder.svg"}
						alt={screens[currentScreen].alt}
						fill
						className="object-cover"
						priority
					/>
				</motion.div>
			</AnimatePresence>
			<div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 z-10">
				{screens.map((_, index) => (
					<button
						key={index}
						className={`h-2 w-2 rounded-full transition-all duration-300 ${
							index === currentScreen ? "w-6 bg-white" : "bg-white/50"
						}`}
						onClick={() => setCurrentScreen(index)}
						aria-label={`View screen ${index + 1}`}
					/>
				))}
			</div>
			<div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
		</>
	);
}
