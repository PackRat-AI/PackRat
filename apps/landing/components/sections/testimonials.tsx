import { siteConfig } from '@/config/site';
import { QuoteIcon } from 'lucide-react';
import GradientText from '@/components/ui/gradient-text';
import GradientBackground from '@/components/ui/gradient-background';
import GradientBorderCard from '@/components/ui/gradient-border-card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="py-20 md:py-28 lg:py-36 relative overflow-hidden bg-muted/50"
    >
      {/* Background pattern */}
      <GradientBackground variant="mesh" />

      <div className="container px-4 md:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
          <GradientBorderCard
            className="inline-block py-1 px-4 text-sm font-medium mb-4"
            containerClassName="inline-block"
            gradientClassName="bg-gradient-to-r from-primary via-secondary to-primary"
          >
            <GradientText>Customer Stories</GradientText>
          </GradientBorderCard>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {siteConfig.testimonials.title}
          </h2>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {siteConfig.testimonials.subtitle}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {siteConfig.testimonials.items.map((testimonial) => (
            <GradientBorderCard key={testimonial.id} className="h-full bg-card/80 backdrop-blur-sm">
              <QuoteIcon className="absolute -top-4 -left-4 h-8 w-8 md:h-10 md:w-10 rotate-180 opacity-10 text-primary" />

              <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
                <Avatar className="h-12 w-12 md:h-14 md:w-14 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm md:text-base">
                    {testimonial.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-bold text-foreground text-sm md:text-base">
                    {testimonial.name}
                  </h4>
                  <GradientText className="text-xs md:text-sm">{testimonial.role}</GradientText>
                </div>
              </div>

              <p className="text-sm md:text-base text-muted-foreground relative line-clamp-4 mb-4">
                "{testimonial.content}"
              </p>

              <div className="mt-4 md:mt-6 flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 md:w-5 md:h-5 ${
                      i < testimonial.rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </GradientBorderCard>
          ))}
        </div>

        <div className="mt-12 md:mt-16 text-center">
          <GradientText
            className="text-base md:text-lg font-medium"
            gradient="bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient"
          >
            Join thousands of happy users today!
          </GradientText>
        </div>
      </div>
    </section>
  );
}
