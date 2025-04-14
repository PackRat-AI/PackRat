"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

interface DeviceMockupProps {
  image: string
  alt: string
  className?: string
  priority?: boolean
  showShadow?: boolean
  showReflection?: boolean
  showGradient?: boolean
  aspectRatio?: "portrait" | "landscape"
}

export default function DeviceMockup({
  image,
  alt,
  className,
  priority = false,
  showShadow = true,
  showReflection = true,
  showGradient = true,
  aspectRatio = "portrait",
}: DeviceMockupProps) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const notchColor = theme === "dark" ? "#000000" : "#1E293B"

  return (
    <div
      className={cn(
        "relative mx-auto transition-all duration-500",
        aspectRatio === "portrait" ? "max-w-[280px] md:max-w-[320px]" : "max-w-[560px]",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect */}
      <div
        className={cn(
          "absolute -inset-4 rounded-[60px] blur-2xl transition-opacity duration-500",
          isHovered ? "opacity-30" : "opacity-0",
        )}
        style={{
          background: "linear-gradient(45deg, hsl(var(--primary)), hsl(var(--secondary)))",
        }}
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-[40px] border-[14px] bg-black transition-transform duration-500",
          aspectRatio === "portrait" ? "aspect-[9/19.5]" : "aspect-[19.5/9]",
          showShadow && "shadow-2xl shadow-black/20",
          isHovered && "scale-[1.02]",
        )}
        style={{ borderColor: notchColor }}
      >
        {/* Notch */}
        {aspectRatio === "portrait" && (
          <div className="absolute top-0 left-1/2 z-10 h-6 w-36 -translate-x-1/2 rounded-b-3xl bg-black"></div>
        )}

        {/* Screen content */}
        <div className="absolute inset-0 overflow-hidden">
          <Image src={image || "/placeholder.svg"} alt={alt} fill className="object-cover" priority={priority} />

          {/* Screen reflection overlay */}
          {showReflection && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-80"></div>
          )}

          {/* Screen gradient overlay */}
          {showGradient && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
          )}
        </div>

        {/* Animated screen glare */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity duration-1000",
            isHovered && "opacity-40",
          )}
          style={{
            transform: isHovered ? "translateX(50%) rotate(15deg)" : "translateX(-50%) rotate(15deg)",
            transition: "transform 1.5s ease-in-out, opacity 0.5s ease-in-out",
          }}
        />
      </div>
    </div>
  )
}
