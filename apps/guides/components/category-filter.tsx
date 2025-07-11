'use client';

import { Badge } from 'guides-app/components/ui/badge';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function CategoryFilter({ categories }: { categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category');

  const handleCategoryClick = (category: string) => {
    const params = new URLSearchParams(searchParams);

    if (currentCategory === category) {
      params.delete('category');
    } else {
      params.set('category', category);
    }

    // Preserve search if it exists
    const searchParam = searchParams.get('search');
    if (searchParam !== null) {
      params.set('search', searchParam);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="mb-8 flex flex-wrap justify-center gap-2">
      <Badge
        variant={!currentCategory ? 'default' : 'outline'}
        className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium bg-apple-blue hover:bg-apple-blue/90 text-white"
        onClick={() => {
          const params = new URLSearchParams(searchParams);
          params.delete('category');

          // Preserve search if it exists
          const searchParam = searchParams.get('search');
          if (searchParam !== null) {
            params.set('search', searchParam);
          }

          router.push(`${pathname}?${params.toString()}`);
        }}
      >
        All Guides
      </Badge>
      {categories.map((category) => (
        <Badge
          key={category}
          variant={currentCategory === category ? 'default' : 'outline'}
          className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium ${
            currentCategory === category
              ? 'bg-apple-blue hover:bg-apple-blue/90 text-white'
              : 'bg-transparent border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          onClick={() => handleCategoryClick(category)}
        >
          {category}
        </Badge>
      ))}
    </div>
  );
}
