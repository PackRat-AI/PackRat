"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "guides-app/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "guides-app/components/ui/sheet";
import { getAllCategories } from "guides-app/lib/categories";
import { navigationConfig, siteConfig } from "guides-app/lib/config";
import { cn } from "guides-app/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Backpack, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "./search";
import { ThemeToggle } from "./theme-toggle";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  // Fetch categories using TanStack Query
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getAllCategories,
  });

  // Add scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Get main nav items from config
  const mainNavItems = navigationConfig.mainNav;

  // Get additional categories not in main nav
  const additionalCategories = categories
    .filter(
      (category) =>
        !mainNavItems.some((item) => item.href.includes(`category=${category}`))
    )
    .slice(0, 8); // Limit to 8 additional categories

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b"
          : "bg-background"
      )}
    >
      <div className="container flex h-16 items-center">
        <div className="flex items-center mr-6">
          <Link href="/" className="flex items-center gap-2">
            <Backpack className="h-5 w-5 text-apple-blue" />
            <span className="text-lg font-semibold">{siteConfig.name}</span>
          </Link>
        </div>

        {/* Desktop navigation - Apple style */}
        <nav className="hidden md:flex flex-1 justify-center">
          <div className="flex space-x-1">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm font-medium rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                {item.title}
              </Link>
            ))}

            {additionalCategories.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-3 py-2 text-sm font-medium rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center">
                    More
                    <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48 rounded-xl">
                  {additionalCategories.map((category) => (
                    <DropdownMenuItem key={category} asChild>
                      <Link href={`/?category=${category}`}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-1 ml-auto">
          <Search />
          <ThemeToggle />

          {/* Mobile menu - Apple style */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="md:hidden ml-1 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Open menu"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 15 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H13.5C13.7761 4 14 3.77614 14 3.5C14 3.22386 13.7761 3 13.5 3H1.5ZM1.5 7C1.22386 7 1 7.22386 1 7.5C1 7.77614 1.22386 8 1.5 8H13.5C13.7761 8 14 7.77614 14 7.5C14 7.22386 13.7761 7 13.5 7H1.5ZM1 11.5C1 11.2239 1.22386 11 1.5 11H13.5C13.7761 11 14 11.2239 14 11.5C14 11.7761 13.7761 12 13.5 12H1.5C1.22386 12 1 11.7761 1 11.5Z"
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[350px]">
              <nav className="flex flex-col gap-4 mt-8">
                {mainNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-2 text-lg font-medium rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {item.title}
                  </Link>
                ))}

                {additionalCategories.length > 0 && (
                  <>
                    <div className="text-sm font-medium text-muted-foreground px-3 pt-4">
                      Categories
                    </div>
                    {additionalCategories.map((category) => (
                      <Link
                        key={category}
                        href={`/?category=${category}`}
                        className="px-3 py-2 text-sm font-medium rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Link>
                    ))}
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
