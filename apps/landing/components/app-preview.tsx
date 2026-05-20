'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function AppPreview() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const screens = [
    {
      src: '/trail-prep.png',
      alt: 'Packing list screen',
    },
    {
      src: '/trail-map-minimal.png',
      alt: 'Trail map screen',
    },
    {
      src: '/hiking-app-weather.png',
      alt: 'Weather screen',
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
      {screens.map((screen, index) => (
        <div
          key={screen.src}
          className={`absolute inset-0 transition-opacity duration-500 ${
            index === currentScreen ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={screen.src}
            alt={screen.alt}
            fill
            className="object-cover"
            priority={index === 0}
          />
        </div>
      ))}
      <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 z-10">
        {screens.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              index === currentScreen ? 'w-6 bg-white' : 'bg-white/50'
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
