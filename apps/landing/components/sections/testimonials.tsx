import { Avatar, AvatarFallback } from 'landing-app/components/ui/avatar';
import { siteConfig } from 'landing-app/config/site';
import { QuoteIcon } from 'lucide-react';

export default function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="py-20 md:py-28 lg:py-36 relative overflow-hidden bg-apple-gray-light dark:bg-gray-900/20"
    >
      <div className="container">
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
          <div className="apple-badge mb-4">Customer Stories</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight sm:text-4xl">
            {siteConfig.testimonials.title}
          </h2>
          <p className="mt-6 text-base md:text-lg leading-relaxed text-muted-foreground max-w-2xl mx-auto">
            {siteConfig.testimonials.subtitle}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {siteConfig.testimonials.items.map((testimonial) => (
            <div key={testimonial.id} className="apple-card h-full relative">
              <QuoteIcon className="absolute -top-4 -left-4 h-8 w-8 md:h-10 md:w-10 rotate-180 opacity-10 text-apple-blue" />

              <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
                <Avatar className="h-12 w-12 md:h-14 md:w-14 border-2 border-border/20">
                  <AvatarFallback className="bg-blue-100 dark:bg-blue-900/30 text-apple-blue font-bold text-sm md:text-base">
                    {testimonial.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold text-foreground text-sm md:text-base">
                    {testimonial.name}
                  </h4>
                  <p className="text-xs md:text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>

              <p className="text-sm md:text-base text-muted-foreground relative line-clamp-4 mb-4">
                "{testimonial.content}"
              </p>

              <div className="mt-4 md:mt-6 flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    // biome-ignore lint/suspicious/noArrayIndexKey: ignore
                    key={i}
                    className={`w-4 h-4 md:w-5 md:h-5 ${
                      i < testimonial.rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 md:mt-16 text-center text-base md:text-lg font-medium text-apple-blue">
          Join thousands of happy users today!
        </div>
      </div>
    </section>
  );
}
