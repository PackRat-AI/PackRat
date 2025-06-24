"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Backpack, Menu, X } from "lucide-react"
import { Button } from "landing-app/components/ui/button"
import { siteConfig } from "landing-app/config/site"
import GradientText from "landing-app/components/ui/gradient-text"
import { ThemeToggle } from "landing-app/components/theme-toggle"
import { cn } from "landing-app/lib/utils"
import { Sheet, SheetContent, SheetTrigger } from "landing-app/components/ui/sheet"

export default function MainNav() {
  const [activeSection, setActiveSection] = useState<string>("")
  const [isScrolled, setIsScrolled] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Handle scroll events to update active section and navbar style
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)

      // Find the current active section based on scroll position
      const sections = siteConfig.mainNav.map((item) => item.href.substring(1))

      // Get all section elements
      const sectionElements = sections.map((id) => document.getElementById(id)).filter(Boolean)

      // Find the section that is currently in view
      const currentSection = sectionElements.find((element) => {
        if (!element) return false
        const rect = element.getBoundingClientRect()
        return rect.top <= 100 && rect.bottom >= 100
      })

      if (currentSection) {
        setActiveSection(`#${currentSection.id}`)
      } else if (window.scrollY < 100) {
        setActiveSection("") // At the top of the page
      }
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll() // Initialize on mount

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Handle smooth scrolling when clicking on navigation links
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    const targetId = href.substring(1)
    const element = document.getElementById(targetId)

    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
      setActiveSection(href)
      setIsOpen(false) // Close mobile menu after clicking
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        isScrolled ? "bg-background/80 shadow-sm backdrop-blur-md py-2" : "bg-transparent py-4",
      )}
    >
      <div className="container flex items-center justify-between px-4 md:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-2 z-10">
          <div className="relative">
            <Backpack className="h-8 w-8 text-primary" />
            <div className="absolute -inset-1.5 rounded-full blur-lg opacity-30 -z-10 bg-primary"></div>
          </div>
          <GradientText className="text-xl font-bold">{siteConfig.name}</GradientText>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {siteConfig.mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => scrollToSection(e, item.href)}
              className={cn(
                "text-sm font-medium tracking-wide transition-colors hover:text-primary",
                activeSection === item.href && "text-primary font-semibold",
              )}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />

          <Button asChild className="hidden md:inline-flex" variant="default">
            <Link href={siteConfig.cta.primary.href} onClick={(e) => scrollToSection(e, siteConfig.cta.primary.href)}>
              {siteConfig.cta.primary.text}
            </Link>
          </Button>

          {/* Mobile menu using Sheet component */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[80vw] sm:w-[350px] pr-0">
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-8 pr-6">
                  <div className="flex items-center gap-2">
                    <Backpack className="h-6 w-6 text-primary" />
                    <GradientText className="text-lg font-bold">{siteConfig.name}</GradientText>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close menu</span>
                  </Button>
                </div>

                <nav className="flex flex-col gap-6 pr-6">
                  {siteConfig.mainNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => scrollToSection(e, item.href)}
                      className={cn(
                        "text-lg font-medium py-2 border-b border-border/20 transition-colors hover:text-primary",
                        activeSection === item.href && "text-primary font-semibold",
                      )}
                    >
                      {item.title}
                    </Link>
                  ))}
                </nav>

                <div className="mt-auto mb-8 pr-6">
                  <Button asChild className="w-full" variant="default">
                    <Link
                      href={siteConfig.cta.primary.href}
                      onClick={(e) => scrollToSection(e, siteConfig.cta.primary.href)}
                    >
                      {siteConfig.cta.primary.text}
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
