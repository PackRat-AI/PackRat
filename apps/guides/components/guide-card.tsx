import { format } from 'date-fns';
import { Badge } from 'guides-app/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from 'guides-app/components/ui/card';
import type { Post } from 'guides-app/lib/types';
import { Calendar, Clock, MountainSnow } from 'lucide-react';
import Link from 'next/link';

export default function GuideCard({ post }: { post: Post }) {
  return (
    <Link href={`/guide/${post.slug}`}>
      <Card className="h-full overflow-hidden transition-all hover:shadow-apple group rounded-2xl border-black/5 dark:border-white/10">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap gap-2">
            {post.categories?.map((category) => (
              <Badge
                variant="secondary"
                key={category}
                className="rounded-full bg-blue-100 text-apple-blue hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
              >
                {category}
              </Badge>
            ))}
          </div>
          <h3 className="line-clamp-2 mt-2 text-xl font-semibold group-hover:text-apple-blue transition-colors">
            {post.title}
          </h3>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-3 text-sm text-muted-foreground">{post.description}</p>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <time dateTime={post.date}>{format(new Date(post.date), 'MMM d, yyyy')}</time>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{post.readingTime || '5 min read'}</span>
          </div>
          {post.difficulty && (
            <div className="flex items-center gap-1">
              <MountainSnow className="h-3 w-3" />
              <span>{post.difficulty}</span>
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
