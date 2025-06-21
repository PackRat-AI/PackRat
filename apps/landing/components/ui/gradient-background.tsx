"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface GradientBackgroundProps {
  className?: string;
  variant?: "primary" | "secondary" | "tertiary" | "mesh";
}

export default function GradientBackground({
  className,
  variant = "primary",
}: GradientBackgroundProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const gradients = {
    primary: {
      light: "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
      dark: "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent",
    },
    secondary: {
      light: "bg-gradient-to-tr from-secondary/10 via-secondary/5 to-transparent",
      dark: "bg-gradient-to-tr from-secondary/20 via-secondary/10 to-transparent",
    },
    tertiary: {
      light: "bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-cyan-500/10",
      dark: "bg-gradient-to-r from-purple-500/20 via-blue-500/10 to-cyan-500/20",
    },
    mesh: {
      light: "bg-gradient-mesh opacity-30",
      dark: "bg-gradient-mesh opacity-20",
    },
  };

  const currentTheme = theme === "dark" ? "dark" : "light";

  return (
    <div className={cn("absolute inset-0 -z-10", gradients[variant][currentTheme], className)} />
  );
}
