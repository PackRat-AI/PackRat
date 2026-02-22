export const metadata = {
  title: 'About Us | PackRat',
  description: 'Learn about PackRat, your ultimate outdoor adventure companion.',
};

export default function AboutPage() {
  return (
    <div className="container max-w-3xl py-12 px-4 md:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">About PackRat</h1>
          <p className="text-muted-foreground">Your trusted companion for outdoor adventures</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Our Story</h2>
          <p>
            PackRat was born from a simple idea: to make outdoor adventures more accessible and
            enjoyable for everyone. Whether you are a seasoned backpacker or planning your first
            camping trip, we believe that proper preparation is the key to memorable experiences.
          </p>
          <p>
            Founded by outdoor enthusiasts, PackRat combines innovative technology with a deep
            understanding of what adventurers need. We have helped thousands of people explore the
            great outdoors with confidence.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Our Mission</h2>
          <p>
            We are on a mission to empower every adventurer to pack smarter and adventure further.
            By providing intelligent packing lists, offline trail maps, and comprehensive trip
            planning tools, we help you focus on what matters most - enjoying your journey.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">What We Offer</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Smart packing lists tailored to your adventure type</li>
            <li>Offline trail maps and navigation</li>
            <li>Weather integration for informed planning</li>
            <li>Trip planning tools with route optimization</li>
            <li>Gear recommendations from outdoor experts</li>
            <li>Community-driven trail database</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Join the Adventure</h2>
          <p>
            With over 10,000 active users and a 4.8-star rating, PackRat is trusted by adventurers
            worldwide. Join our community and discover new trails, share your experiences, and
            connect with fellow outdoor enthusiasts.
          </p>
        </section>
      </div>
    </div>
  );
}
