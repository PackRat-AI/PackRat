import type { Post } from "@/lib/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export default function FeaturedGuides({ guides }: { guides: Post[] }) {
  if (!guides.length) return null;

  const mainGuide = guides[0];
  const secondaryGuides = guides.slice(1);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Main featured guide - Apple style */}
      <Card className="rounded-2xl overflow-hidden border-black/5 dark:border-white/10 bg-white dark:bg-gray-900 shadow-apple">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap gap-2 mb-2">
            {mainGuide.categories?.map((category) => (
              <Badge
                key={category}
                className="rounded-full px-3 py-1 bg-apple-blue hover:bg-apple-blue/90 text-white"
              >
                {category}
              </Badge>
            ))}
          </div>
          <h3 className="text-2xl font-semibold">{mainGuide.title}</h3>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{mainGuide.description}</p>
        </CardContent>
        <CardFooter>
          <Button asChild className="rounded-full bg-apple-blue hover:bg-apple-blue/90 text-white">
            <Link href={`/guide/${mainGuide.slug}`} className="flex items-center gap-2">
              Read Guide
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Secondary featured guides - Apple style */}
      <div className="grid gap-6">
        {secondaryGuides.map((guide) => (
          <Card
            key={guide.slug}
            className="rounded-2xl overflow-hidden border-black/5 dark:border-white/10 bg-white dark:bg-gray-900"
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap gap-2 mb-1">
                {guide.categories?.slice(0, 1).map((category) => (
                  <Badge
                    key={category}
                    className="rounded-full px-3 py-1 bg-apple-blue hover:bg-apple-blue/90 text-white"
                  >
                    {category}
                  </Badge>
                ))}
              </div>
              <h3 className="text-lg font-semibold">{guide.title}</h3>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-sm text-muted-foreground line-clamp-2">{guide.description}</p>
            </CardContent>
            <CardFooter>
              <Button
                asChild
                variant="link"
                className="p-0 text-apple-blue hover:text-apple-blue/90"
              >
                <Link href={`/guide/${guide.slug}`} className="flex items-center gap-1">
                  Read Guide
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
