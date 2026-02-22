'use client';

import { Button } from 'landing-app/components/ui/button';
import { Input } from 'landing-app/components/ui/input';
import { Textarea } from 'landing-app/components/ui/textarea';
import Link from 'next/link';
import { useId } from 'react';

export default function ContactPage() {
  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const subjectId = useId();
  const messageId = useId();
  return (
    <div className="container max-w-3xl py-12 px-4 md:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Contact Us</h1>
          <p className="text-muted-foreground">We would love to hear from you</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight mb-4">Get in Touch</h2>
              <p className="text-muted-foreground">
                Have a question, suggestion, or just want to say hello? We are here to help and
                would love to hear from you.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium">General Inquiries</h3>
                <Link href="mailto:hello@packratai.com" className="text-primary hover:underline">
                  hello@packratai.com
                </Link>
              </div>
              <div>
                <h3 className="font-medium">Support</h3>
                <Link href="mailto:support@packratai.com" className="text-primary hover:underline">
                  support@packratai.com
                </Link>
              </div>
              <div>
                <h3 className="font-medium">Business Partnerships</h3>
                <Link
                  href="mailto:partnerships@packratai.com"
                  className="text-primary hover:underline"
                >
                  partnerships@packratai.com
                </Link>
              </div>
              <div>
                <h3 className="font-medium">Press & Media</h3>
                <Link href="mailto:press@packratai.com" className="text-primary hover:underline">
                  press@packratai.com
                </Link>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <h3 className="font-medium mb-2">Response Time</h3>
              <p className="text-sm text-muted-foreground">
                We typically respond to inquiries within 24-48 hours during business days.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Send a Message</h2>
            <form className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={firstNameId} className="text-sm font-medium">
                    First Name
                  </label>
                  <Input id={firstNameId} placeholder="John" />
                </div>
                <div className="space-y-2">
                  <label htmlFor={lastNameId} className="text-sm font-medium">
                    Last Name
                  </label>
                  <Input id={lastNameId} placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor={emailId} className="text-sm font-medium">
                  Email
                </label>
                <Input id={emailId} type="email" placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <label htmlFor={subjectId} className="text-sm font-medium">
                  Subject
                </label>
                <Input id={subjectId} placeholder="How can we help?" />
              </div>
              <div className="space-y-2">
                <label htmlFor={messageId} className="text-sm font-medium">
                  Message
                </label>
                <Textarea id={messageId} placeholder="Tell us more about your inquiry..." rows={4} />
              </div>
              <Button type="button" className="w-full">
                Send Message
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                This form is for demonstration. Please email us directly for real inquiries.
              </p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
