import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import aboutHero from "@/assets/about-hero.jpg";

const AboutPage = () => {
  return (
    <div>
      {/* Hero */}
      <section className="section-dark relative overflow-hidden">
        <img src={aboutHero} alt="" className="absolute inset-0 w-full h-full object-cover object-[center_35%] opacity-30" />
        <div className="container py-20 md:py-28 animate-fade-in relative z-10">
          <p className="section-label">Our Story</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl lg:text-7xl text-white leading-[0.95] max-w-2xl">
            About Holden
          </h1>
        </div>
      </section>

      {/* Story */}
      <section className="section-light">
        <div className="container py-20 md:py-28 max-w-3xl">
          <div className="space-y-6 text-foreground/70 leading-relaxed text-left animate-fade-in">
            <p className="text-lg">
              Holden Stewart is a 7-year-old from Brandon, Manitoba with a personality that fills every room
              he walks into. He plays pranks on his brother Hudson and sister Harper, cracks jokes at every
              opportunity, loves swimming, and approaches life with the kind of fearless optimism most adults
              can only admire.
            </p>
            <p>
              Holden also lives with Ataxia Telangiectasia (A-T), a rare genetic disorder that affects his
              mobility, speech, and immune system. His family received the diagnosis in the fall of 2021,
              shortly before his second birthday, after a series of evaluations confirmed what subtle signs
              had begun to suggest.
            </p>
            <p>
              A-T touches every part of daily life, but it doesn't define Holden. He's a kid first. Curious,
              funny, and stubborn in the best possible way.
            </p>

            <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-foreground pt-4">Family &amp; Community</h2>
            <p>
              Holden's parents, Derrick and Jill, along with their extended family, advocate not just for
              Holden but for every family navigating A-T. The Brandon community has rallied around the
              Stewarts with the kind of support that only a tight-knit prairie city can deliver.
            </p>
          </div>
        </div>
      </section>

      {/* Quote — dark section */}
      <section className="section-dark">
        <div className="container py-20 md:py-28 text-center animate-fade-in">
          <blockquote className="font-heading font-extrabold text-4xl md:text-6xl text-primary leading-tight mb-6">
            "Beat Disease"
          </blockquote>
          <p className="text-white/40 font-heading uppercase tracking-[0.2em] text-sm">— Holden Stewart</p>
        </div>
      </section>

      {/* What is A-T */}
      <section className="section-light">
        <div className="container py-20 md:py-28 max-w-3xl animate-fade-in">
          <p className="section-label">Understanding the Disease</p>
          <h2 className="font-heading font-extrabold text-2xl md:text-4xl text-foreground mb-6">
            What is Ataxia Telangiectasia?
          </h2>
          <p className="text-foreground/60 leading-relaxed mb-8 text-left">
            A-T is a rare genetic condition that affects the nervous system, immune system, and other body
            systems. It typically appears in early childhood and progressively affects coordination and
            movement. There is currently no cure, but research is advancing.
          </p>
          <Button asChild className="rounded bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-bold uppercase tracking-wider">
            <a href="https://www.atcp.org" target="_blank" rel="noopener noreferrer">
              Learn More at ATCP.org <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </div>
      </section>

      {/* What You Can Do */}
      <section className="section-dark">
        <div className="container py-20 md:py-28 text-center animate-fade-in">
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-white mb-6">What You Can Do</h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto mb-10">
            The Hope 4 Holden tournament raises funds for the Ataxia Telangiectasia Children's Project
            (ATCP), which funds research toward treatments and a cure. Every dollar raised goes directly
            to that mission.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            <Button asChild size="lg" className="rounded bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-bold uppercase tracking-wider px-8">
              <Link to="/register">Register Your Team</Link>
            </Button>
            <Button asChild size="lg" className="rounded bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-bold uppercase tracking-wider px-8">
              <Link to="/sponsor">Become a Sponsor</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5 font-heading font-semibold uppercase tracking-wider px-8">
              <Link to="/donate">Make a Donation</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
