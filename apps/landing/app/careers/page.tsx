import { Badge } from 'landing-app/components/ui/badge';
import { Button } from 'landing-app/components/ui/button';
import { Card, CardContent, CardHeader } from 'landing-app/components/ui/card';
import { Briefcase, Clock, DollarSign, Globe, Heart, Laptop, MapPin, Zap } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Careers | PackRat',
  description:
    'Join the PackRat team and help build the future of travel preparation. View open positions.',
};

export default function CareersPage() {
  const benefits = [
    {
      id: 'remote',
      icon: Globe,
      title: 'Remote First',
      description: 'Work from anywhere in the world. We believe in flexibility and trust.',
    },
    {
      id: 'health',
      icon: Heart,
      title: 'Health & Wellness',
      description: 'Comprehensive health insurance and wellness stipend for your wellbeing.',
    },
    {
      id: 'learning',
      icon: Zap,
      title: 'Learning Budget',
      description: 'Annual budget for courses, conferences, and personal development.',
    },
    {
      id: 'office',
      icon: Laptop,
      title: 'Home Office Setup',
      description: 'Get the equipment you need to do your best work from home.',
    },
    {
      id: 'salary',
      icon: DollarSign,
      title: 'Competitive Salary',
      description: 'Fair compensation based on experience and market rates.',
    },
    {
      id: 'travel',
      icon: MapPin,
      title: 'Travel Stipend',
      description: 'Annual travel budget to explore the world and test our product.',
    },
  ];

  const openPositions = [
    {
      id: 'senior-dev',
      title: 'Senior Full Stack Developer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description:
        'Help build and scale our platform using React Native, Node.js, and modern cloud infrastructure.',
    },
    {
      id: 'designer',
      title: 'Product Designer',
      department: 'Design',
      location: 'Remote',
      type: 'Full-time',
      description:
        'Create beautiful, intuitive experiences for travelers using PackRat across web and mobile.',
    },
    {
      id: 'mobile-dev',
      title: 'Mobile Developer (iOS/Android)',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description:
        'Build and optimize our mobile apps to deliver the best packing experience on the go.',
    },
    {
      id: 'content-manager',
      title: 'Content Marketing Manager',
      department: 'Marketing',
      location: 'Remote',
      type: 'Full-time',
      description: 'Create engaging content that inspires travelers and grows our community.',
    },
  ];

  return (
    <div className="container max-w-5xl py-12 px-4 md:px-6">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Join Our Team</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Help us build the future of travel preparation. We&apos;re looking for passionate people
            who love adventure and great products.
          </p>
        </div>

        <section className="space-y-8">
          <h2 className="text-3xl font-bold tracking-tight text-center">Why Work at PackRat?</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <Card key={benefit.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-3">
                  <benefit.icon className="h-8 w-8 text-primary" />
                  <h3 className="text-xl font-semibold">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <h2 className="text-3xl font-bold tracking-tight">Open Positions</h2>
          <div className="space-y-4">
            {openPositions.map((position) => (
              <Card key={position.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold">{position.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{position.department}</Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {position.location}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {position.type}
                        </Badge>
                      </div>
                    </div>
                    <Button asChild className="w-full md:w-auto">
                      <Link href="/contact">
                        <Briefcase className="h-4 w-4 mr-2" />
                        Apply Now
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{position.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="text-center space-y-6 py-8">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8 space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">Don&apos;t See the Right Fit?</h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                We&apos;re always looking for talented people. Send us your resume and tell us how
                you can contribute to PackRat.
              </p>
              <Button asChild size="lg" className="mt-4">
                <Link href="/contact">Get in Touch</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
