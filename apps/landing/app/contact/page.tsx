'use client';

import { Button } from 'landing-app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'landing-app/components/ui/card';
import { Input } from 'landing-app/components/ui/input';
import { Label } from 'landing-app/components/ui/label';
import { Textarea } from 'landing-app/components/ui/textarea';
import { Mail, MapPin, MessageSquare, Phone } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';

export default function ContactPage() {
  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const subjectId = useId();
  const messageId = useId();
  return (
    <div className="container max-w-5xl py-12 px-4 md:px-6">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Contact Us</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Have a question, feedback, or just want to say hello? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Send us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={firstNameId}>First Name</Label>
                      <Input id={firstNameId} placeholder="John" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={lastNameId}>Last Name</Label>
                      <Input id={lastNameId} placeholder="Doe" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={emailId}>Email</Label>
                    <Input id={emailId} type="email" placeholder="john@example.com" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={subjectId}>Subject</Label>
                    <Input id={subjectId} placeholder="How can we help?" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={messageId}>Message</Label>
                    <Textarea
                      id={messageId}
                      placeholder="Tell us more about your inquiry..."
                      rows={5}
                    />
                  </div>

                  <Button type="button" className="w-full">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">Email Us</h3>
                      <p className="text-sm text-muted-foreground">
                        For general inquiries and support
                      </p>
                      <Link
                        href="mailto:hello@packratai.com"
                        className="text-primary hover:underline"
                      >
                        hello@packratai.com
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">Call Us</h3>
                      <p className="text-sm text-muted-foreground">Mon-Fri from 9am to 5pm EST</p>
                      <Link href="tel:+1-555-123-4567" className="text-primary hover:underline">
                        +1 (555) 123-4567
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">Office</h3>
                      <p className="text-sm text-muted-foreground">
                        123 Innovation Drive
                        <br />
                        San Francisco, CA 94105
                        <br />
                        United States
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold text-lg">Join Our Community</h3>
                  <p className="text-muted-foreground">
                    Connect with fellow travelers, share tips, and stay updated on the latest
                    PackRat features.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Link href="#" className="text-primary hover:underline">
                      Twitter / X
                    </Link>
                    <Link href="#" className="text-primary hover:underline">
                      Instagram
                    </Link>
                    <Link href="#" className="text-primary hover:underline">
                      Discord Community
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>

        <section className="text-center space-y-4 py-8">
          <h2 className="text-2xl font-bold tracking-tight">Frequently Asked Questions</h2>
          <p className="text-muted-foreground">
            Find answers to common questions on our{' '}
            <Link href="/" className="text-primary hover:underline font-medium">
              homepage
            </Link>{' '}
            or check our{' '}
            <Link href="/privacy-policy" className="text-primary hover:underline font-medium">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
