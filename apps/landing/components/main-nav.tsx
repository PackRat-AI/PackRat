'use client';

import { cn } from '@packrat/web-ui/lib/utils';
import { ThemeToggle } from 'landing-app/components/theme-toggle';
import { Sheet, SheetContent, SheetTrigger } from 'landing-app/components/ui/sheet';
import { siteConfig } from 'landing-app/config/site';
import { Backpack, Menu, X } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';

export default function MainNav() {
  const [activeSection, setActiveSection] = useState<string>('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);

      const sections = siteConfig.mainNav.map((item) => item.href.substring(1));
      const sectionElements = sections.map((id) => document.getElementById(id)).filter(Boolean);

      const currentSection = sectionElements.find((element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.top <= 100 && rect.bottom >= 100;
      });

      if (currentSection) {
        setActiveSection(`#${currentSection.id}`);
      } else if (window.scrollY < 100) {
        setActiveSection('');
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('http')) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    e.preventDefault();
    const targetId = href.substring(1);
    const element = document.getElementById(targetId);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(href);
      setIsOpen(false);
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        isScrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/40 py-2'
          : 'bg-background py-4',
      )}
    >
      <div className="container flex h-10 items-center">
        {/* Logo */}
        <div className="flex items-center mr-6">
          <Link href="/" className="flex items-center gap-2">
            <Backpack className="h-5 w-5 text-apple-blue" />
            <span className="text-lg font-semibold">{siteConfig.name}</span>
          </Link>
        </div>

        {/* Desktop navigation – Apple style: centered, rounded-full hover */}
        <nav className="hidden md:flex flex-1 justify-center">
          <div className="flex space-x-1">
            {siteConfig.mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => scrollToSection(e, item.href)}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors',
                  activeSection === item.href
                    ? 'text-apple-blue font-semibold'
                    : 'text-foreground/80',
                )}
              >
                {item.title}
              </Link>
            ))}
          </div>
        </nav>

        {/* Right side: theme toggle + CTA */}
        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />

          <Link
            href={siteConfig.cta.primary.href}
            onClick={(e) => scrollToSection(e, siteConfig.cta.primary.href)}
            className="hidden md:inline-flex items-center gap-1.5 ml-2 px-4 py-1.5 rounded-full bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 transition-colors"
          >
            {siteConfig.cta.primary.text}
          </Link>

          {/* Mobile hamburger */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="md:hidden ml-1 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[350px]">
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2">
                    <Backpack className="h-5 w-5 text-apple-blue" />
                    <span className="text-lg font-semibold">{siteConfig.name}</span>
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="flex flex-col gap-2">
                  {siteConfig.mainNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => scrollToSection(e, item.href)}
                      className={cn(
                        'px-3 py-2 text-base font-medium rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors',
                        activeSection === item.href ? 'text-apple-blue font-semibold' : '',
                      )}
                    >
                      {item.title}
                    </Link>
                  ))}
                </nav>

                <div className="mt-auto mb-6">
                  <Link
                    href={siteConfig.cta.primary.href}
                    onClick={(e) => scrollToSection(e, siteConfig.cta.primary.href)}
                    className="flex items-center justify-center w-full px-4 py-2.5 rounded-full bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 transition-colors"
                  >
                    {siteConfig.cta.primary.text}
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
