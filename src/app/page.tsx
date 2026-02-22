import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function LandingPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b-2 border-border px-6 py-4">
        <span className="font-mono text-xl font-black uppercase tracking-tight">
          Poke<span className="text-primary">Play</span>
        </span>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="border-b-2 border-border px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <Badge className="mb-6 bg-accent text-accent-foreground">
            Browser-based · No install needed
          </Badge>
          <h1 className="mb-6 text-6xl font-black uppercase leading-none tracking-tighter">
            Play Pokémon
            <br />
            <span className="text-primary">ROM Hacks</span>
            <br />
            Anywhere.
          </h1>
          <p className="mb-10 max-w-xl text-lg text-muted-foreground">
            Load your ROM files, play fan-made Pokémon hacks in your browser, sync your saves to
            the cloud, and explore the world together with friends — in real time.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" asChild className="shadow-md">
              <Link href="/register">Start Playing Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">Browse Library</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b-2 border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-3xl font-black uppercase tracking-tighter">
            Everything you need.
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon="GB"
              title="ROM Library"
              description="Load .gb, .gbc, and .gba ROM files. Your ROMs stay in your browser — they never leave your device."
            />
            <FeatureCard
              icon="CL"
              title="Cloud Saves"
              description="Your save files sync automatically to the cloud. Pick up exactly where you left off on any device."
            />
            <FeatureCard
              icon="MP"
              title="Multiplayer"
              description="See your friends' characters on the overworld map in real time. Explore Kanto together."
            />
            <FeatureCard
              icon="BP"
              title="BPS Patches"
              description="Apply fan-made patches directly in the browser. No external tools, no setup."
            />
            <FeatureCard
              icon="PV"
              title="Privacy First"
              description="ROM data never hits our servers. We only store your save files and patch metadata."
            />
            <FeatureCard
              icon="OS"
              title="Open Source"
              description="Built on EmulatorJS, Supabase, and Next.js. The platform is transparent and community-driven."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b-2 border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-3xl font-black uppercase tracking-tighter">
            Get playing in 3 steps.
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <StepCard
              number="01"
              title="Upload Your ROM"
              description="Drop a .gb, .gbc, or .gba file into PokéPlay. It's verified and stored locally in your browser."
            />
            <StepCard
              number="02"
              title="Create an Account"
              description="Sign up to enable cloud saves and multiplayer. Your ROM never leaves your device."
            />
            <StepCard
              number="03"
              title="Play & Share"
              description="Hit Play and start your adventure. Invite friends to explore the same world together."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="mb-4 text-4xl font-black uppercase tracking-tighter">
            Ready to play?
          </h2>
          <p className="mb-8 text-muted-foreground">
            No credit card required. No download. Just your ROM and a browser.
          </p>
          <Button size="lg" asChild className="shadow-md">
            <Link href="/register">Create Free Account</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-border px-6 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between text-sm text-muted-foreground">
          <span className="font-mono font-bold">
            Poke<span className="text-primary">Play</span>
          </span>
          <span>Built for the community. ROMs are your property.</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <Card className="border-2 border-border shadow-sm">
      <CardContent className="p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center border-2 border-border bg-accent font-mono text-sm font-black text-accent-foreground">
          {icon}
        </div>
        <h3 className="mb-2 font-bold uppercase tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <div className="border-2 border-border p-6 shadow-sm">
      <div className="mb-4 font-mono text-4xl font-black text-primary">{number}</div>
      <h3 className="mb-2 font-bold uppercase tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
