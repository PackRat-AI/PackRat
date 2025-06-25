'use client';

import type React from 'react';
import Link from 'next/link';
import { Download, ChevronRight, ArrowRight, Star } from 'lucide-react';
import { Button } from 'landing-app/components/ui/button';
import { siteConfig } from 'landing-app/config/site';
import DeviceMockup from 'landing-app/components/ui/device-mockup';
import GlassCard from 'landing-app/components/ui/glass-card';
import GradientText from 'landing-app/components/ui/gradient-text';
import GradientBackground from 'landing-app/components/ui/gradient-background';
import { motion } from 'framer-motion';

export default function LandingHero() {
  // Handle smooth scrolling when clicking on navigation links
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.substring(1);
    const element = document.getElementById(targetId);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 10,
      },
    },
  };

  return (
    <section className="relative py-16 overflow-hidden md:py-24 lg:py-32">
      {/* Background decoration */}
      <GradientBackground variant="mesh" />

      {/* Decorative elements */}
      <div className="absolute top-20 -left-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl -z-10 bg-primary/50 dark:bg-primary/30"></div>

      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full opacity-10 blur-3xl -z-10 bg-secondary/50 dark:bg-secondary/30"></div>

      <div className="container px-4 md:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <motion.div
            className="space-y-6 max-w-2xl"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <GlassCard className="inline-flex items-center py-1.5 px-4 text-sm font-medium">
                <span className="mr-1.5 h-2 w-2 rounded-full animate-pulse bg-primary"></span>
                <GradientText>{siteConfig.hero.badge}</GradientText>
              </GlassCard>
            </motion.div>

            <motion.h1
              className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl xl:text-6xl max-w-screen-sm"
              variants={itemVariants}
            >
              <span className="block text-foreground">{siteConfig.hero.title.split('.')[0]}.</span>
              <GradientText
                className="block mt-1"
                gradient="bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient"
              >
                {siteConfig.hero.title.split('.')[1]}.
              </GradientText>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-muted-foreground max-w-xl"
              variants={itemVariants}
            >
              {siteConfig.hero.subtitle}
            </motion.p>

            <motion.div className="flex flex-col sm:flex-row gap-4" variants={itemVariants}>
              <Button asChild size="lg" className="group relative overflow-hidden">
                <Link
                  href={siteConfig.cta.primary.href}
                  onClick={(e) => scrollToSection(e, siteConfig.cta.primary.href)}
                >
                  <div className="absolute inset-0 w-full h-full transition-all duration-300 ease-out translate-y-full group-hover:translate-y-0 bg-black/10 dark:bg-white/10"></div>
                  <Download className="mr-2 h-5 w-5" />
                  {siteConfig.cta.primary.text}
                  <ArrowRight className="ml-2 h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="group">
                <Link
                  href={siteConfig.cta.secondary.href}
                  onClick={(e) => scrollToSection(e, siteConfig.cta.secondary.href)}
                >
                  {siteConfig.cta.secondary.text}
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row items-center gap-6 pt-4"
              variants={itemVariants}
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-background flex items-center justify-center overflow-hidden bg-primary/20"
                  >
                    <span className="text-xs font-bold text-primary">
                      {String.fromCharCode(64 + i)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {siteConfig.hero.stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-xl font-bold text-primary">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative mx-auto lg:mx-0"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <DeviceMockup
              image="/hero-app-preview.png"
              alt="PackRat App"
              priority
              showReflection
              showGradient
            />

            {/* Floating UI elements - only show on larger screens */}
            <motion.div
              className="absolute top-[10%] -left-16 hidden lg:block"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <GlassCard className="p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary">
                    <Star className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div>
                    <div className="text-xs font-medium">App Store Rating</div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div
              className="absolute bottom-[15%] -right-10 hidden lg:block"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <GlassCard className="p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary">
                    <Download className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="text-xs font-medium">Downloads</div>
                    <div className="text-sm font-bold">10,000+</div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
