import { Button } from 'landing-app/components/ui/button';
import Link from 'next/link';

export const metadata = {
  title: 'Careers | PackRat',
  description: 'Join the PackRat team and help build the future of outdoor adventure planning.',
};

const openPositions = [
  {
    id: 1,
    title: 'Senior Full Stack Developer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
  },
  {
    id: 2,
    title: 'Product Designer',
    department: 'Design',
    location: 'Remote',
    type: 'Full-time',
  },
  {
    id: 3,
    title: 'Content Marketing Manager',
    department: 'Marketing',
    location: 'Remote',
    type: 'Full-time',
  },
  {
    id: 4,
    title: 'Customer Success Specialist',
    department: 'Support',
    location: 'Remote',
    type: 'Full-time',
  },
];

const benefits = [
  'Competitive salary and equity',
  'Flexible remote work policy',
  'Unlimited PTO',
  'Health, dental, and vision insurance',
  'Annual outdoor adventure stipend',
  'Professional development budget',
  'Team retreats in beautiful locations',
];

export default function CareersPage() {
  return (
    <div className="container max-w-3xl py-12 px-4 md:px-6">
      <div className="space-y-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Careers at PackRat</h1>
          <p className="text-muted-foreground">
            Join us in building the future of outdoor adventure
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Why Work With Us</h2>
          <p>
            At PackRat, we are passionate about the outdoors and committed to helping others
            experience the joy of adventure. As a member of our team, you will have the opportunity
            to work on meaningful products that impact thousands of outdoor enthusiasts worldwide.
          </p>
          <p>
            We believe in fostering a culture of innovation, collaboration, and work-life balance.
            Our remote-first approach means you can work from wherever you are most productive,
            whether that is a home office or a campsite.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Benefits & Perks</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Open Positions</h2>
          {openPositions.length > 0 ? (
            <div className="grid gap-4">
              {openPositions.map((position) => (
                <div
                  key={position.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border p-4"
                >
                  <div>
                    <h3 className="font-semibold">{position.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {position.department} • {position.location} • {position.type}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`mailto:careers@packratai.com?subject=Application for ${position.title}`}
                    >
                      Apply Now
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No open positions at the moment. Check back soon!
            </p>
          )}
        </section>

        <section className="rounded-lg bg-muted p-6 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Don&apos;t See a Perfect Fit?</h2>
          <p className="text-muted-foreground">
            We are always looking for talented individuals who are passionate about the outdoors.
            Send us your resume and tell us how you can contribute to our mission.
          </p>
          <Button asChild>
            <Link href="mailto:careers@packratai.com?subject=General Application">
              Send General Application
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
