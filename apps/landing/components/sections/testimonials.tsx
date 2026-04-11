import { Avatar, AvatarFallback } from 'landing-app/components/ui/avatar';
import GradientBackground from 'landing-app/components/ui/gradient-background';
import GradientBorderCard from 'landing-app/components/ui/gradient-border-card';
import GradientText from 'landing-app/components/ui/gradient-text';
import { siteConfig } from 'landing-app/config/site';
import { Star } from 'lucide-react';

export default function TestimonialsSection() {
  return (
    // biome-ignore lint/nursery/useUniqueElementIds: ignore
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
          <p className="mt-6 text-base md:text-lg leading-relaxed text-muted-foreground max-w-2xl mx-auto">
            {siteConfig.testimonials.subtitle}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {siteConfig.testimonials.items.slice(0, 3).map((testimonial) => (
            <GradientBorderCard
              key={testimonial.id}
              className="h-full bg-card/80 backdrop-blur-sm flex flex-col"
            >
              {/* Typographic opening quote */}
              <div className="text-5xl leading-none text-primary/20 font-serif mb-2 select-none">
                &ldquo;
              </div>

              <p className="text-sm md:text-base leading-relaxed text-muted-foreground flex-1 mb-6">
                {testimonial.content}
              </p>

              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    // biome-ignore lint/suspicious/noArrayIndexKey: ignore
                    key={i}
                    className="w-4 h-4 text-amber-400 fill-amber-400"
                    aria-hidden="true"
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {testimonial.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-foreground text-sm">{testimonial.name}</div>
                  <GradientText className="text-xs">{testimonial.role}</GradientText>
                </div>
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
