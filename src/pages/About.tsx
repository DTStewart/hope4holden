import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import aboutHero from "@/assets/about-hero.jpg";

const AboutPage = () => {
  return (
    <div>
      {/* Hero */}
      <section className="section-dark relative overflow-hidden">
        <img src={aboutHero} alt="" className="absolute inset-0 w-full h-full object-cover object-[center_60%] opacity-30" />
        <div className="container py-20 md:py-28 animate-fade-in relative z-10">
          <p className="section-label">Our Story</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl lg:text-7xl text-white leading-[0.95] max-w-2xl">
            About Holden
          </h1>
          <p className="text-white/60 text-lg mt-6 max-w-xl">
            A story of courage, resilience, and hope from Brandon, Manitoba.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="section-light">
        <div className="container py-20 md:py-28 max-w-3xl">
          <div className="space-y-8 text-[#1A1A1A]/70 leading-relaxed text-left animate-fade-in">
            <p className="text-lg">
              Holden Stewart is a vibrant and inspiring young boy from Brandon, Manitoba, who faces life
              with a rare genetic disorder known as Ataxia Telangiectasia (A-T). Diagnosed in the fall of
              2021, Holden's journey has been one of courage and resilience, touching all who know him.
            </p>

            <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A] pt-4">Diagnosis</h2>
            <p>
              As Holden approached 2 years old, subtle signs began to suggest that something was amiss.
              After a series of evaluations, the diagnosis of A-T was confirmed. This moment was both
              sobering and clarifying, marking the beginning of a new chapter for Holden and his family.
            </p>

            <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A] pt-4">Living with A-T</h2>
            <p>
              Ataxia Telangiectasia affects various aspects of Holden's health, including his mobility and
              speech. Despite these challenges, Holden approaches each day with an infectious optimism and
              an unyielding spirit.
            </p>
            <p>
              Holden continues to take part in many of the activities that you would expect of a 7 year
              old boy — playing pranks on his siblings, joking around, swimming and playing all kinds of games.
            </p>

            <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A] pt-4">Family & Community</h2>
            <p>
              The support from Holden's family — his parents Derrick and Jill, along with extended family
              and friends — has been pivotal. The Brandon community has also rallied around Holden,
              embracing him with love and support.
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
          <h2 className="font-heading font-extrabold text-2xl md:text-4xl text-[#1A1A1A] mb-6">
            What is Ataxia Telangiectasia?
          </h2>
          <p className="text-[#1A1A1A]/60 leading-relaxed mb-8 text-left">
            A-T is a rare genetic condition that affects the nervous system, immune system, and other body
            systems. It typically appears in early childhood and progressively affects coordination, movement,
            and other bodily functions. While there is currently no cure, research funded by organizations
            like the ATCP is making progress toward better treatments.
          </p>
          <Button asChild className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider">
            <a href="https://www.atcp.org" target="_blank" rel="noopener noreferrer">
              Learn More at ATCP.org <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </div>
      </section>

      {/* CTA */}
      <section className="section-dark">
        <div className="container py-20 md:py-28 text-center animate-fade-in">
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-white mb-6">Join the Journey</h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto mb-10">
            Hope 4 Holden is more than a fundraiser — it's a movement of hope and solidarity.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider px-8">
              <Link to="/register">Register Your Team</Link>
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
