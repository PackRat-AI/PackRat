import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'landing-app/components/ui/accordion';
import { CardContent } from 'landing-app/components/ui/card';
import GradientBackground from 'landing-app/components/ui/gradient-background';
import GradientBorderCard from 'landing-app/components/ui/gradient-border-card';
import GradientText from 'landing-app/components/ui/gradient-text';
import { siteConfig } from 'landing-app/config/site';

export default function FaqSection() {
  // Filter out any pricing-related FAQs or modify them
  const faqs = siteConfig.faqs.map((faq) => {
    // If the FAQ is about pricing, modify it to mention the app is free
    if (
      faq.question.toLowerCase().includes('free') ||
      faq.question.toLowerCase().includes('price') ||
      faq.question.toLowerCase().includes('cost')
    ) {
      return {
        question: 'Is PackRat free to use?',
        answer:
          'Yes! PackRat is completely free to use with all features included. We may introduce premium features in the future, but our core functionality will always remain free.',
      };
    }
    return faq;
  });

  return (
    <section id="faq" className="py-20 md:py-28 lg:py-36 relative overflow-hidden">
      {/* Background pattern */}
      <GradientBackground variant="mesh" />

      <div className="container px-4 md:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
          <GradientBorderCard
            className="inline-block py-1 px-4 text-sm font-medium mb-4"
            containerClassName="inline-block"
            gradientClassName="bg-gradient-to-r from-primary via-secondary to-primary"
          >
            <GradientText>Got Questions?</GradientText>
          </GradientBorderCard>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Got questions? We've got answers. Here are some of the most common questions our users
            ask.
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <GradientBorderCard className="bg-card/80 backdrop-blur-sm">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <div key={index}>
                  <AccordionItem value={`item-${index}`} className="border-b border-border">
                    <AccordionTrigger className="text-base md:text-lg font-medium text-foreground hover:text-primary transition-colors py-4 px-1">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm md:text-base text-muted-foreground px-1 pb-4">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </div>
              ))}
            </Accordion>
          </GradientBorderCard>

          <div className="mt-10 md:mt-12 text-center">
            <GradientBorderCard className="bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
                <h3 className="text-base md:text-lg font-medium text-foreground">
                  Still have questions?
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Can't find the answer you're looking for? Please reach out to our customer support
                  team.
                </p>
                <a
                  href="#"
                  className="inline-flex items-center text-sm font-medium transition-colors text-primary"
                >
                  <GradientText gradient="bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient">
                    Contact support
                  </GradientText>
                  <svg
                    className="ml-1 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </CardContent>
            </GradientBorderCard>
          </div>
        </div>
      </div>
    </section>
  );
}
