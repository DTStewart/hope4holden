import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroBg from "@/assets/hero-bg.jpg";
import h4hLogo from "@/assets/h4h-logo.png";

const HomePage = () => {
  const [sponsors, setSponsors] = useState<{ id: string; business_name: string; tier_name: string; logo_url: string | null }[]>([]);

  useEffect(() => {
    supabase
      .from("sponsors_public" as any)
      .select("id, business_name, tier_name, logo_url")
      .then(({ data }: any) => {
        if (data) setSponsors(data);
      });
  }, []);

  return (
    <div>
      {/* Hero — bold, dark, full-bleed */}
      <section className="relative bg-[#1A1A1A] overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Kids in H4H shirts at the golf tournament" className="w-full h-full object-cover opacity-50" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A]/90 via-[#1A1A1A]/60 to-transparent" />
        <div className="container relative py-28 md:py-40 lg:py-48">
          <div className="max-w-3xl animate-fade-in">
            <img src={h4hLogo} alt="Hope 4 Holden logo" className="h-20 md:h-28 w-auto invert mb-6" />
            <p className="font-heading font-bold text-xs tracking-[0.3em] uppercase text-primary mb-6">
              Charity Golf Tournament
            </p>
            <p className="font-heading font-bold text-xl md:text-2xl text-primary mb-4">
              Driving for a Cure
            </p>
            <p className="text-lg text-white/60 max-w-xl mb-10">
              June 18–19, 2026 · Brandon, Manitoba<br />
              Two days of golf, dinner, and community — all for a cure.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="text-base font-heading font-bold uppercase tracking-wider px-8 rounded bg-primary text-white hover:bg-[#4A7C09]">
                <Link to="/register">Register Your Team</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="text-base font-heading font-semibold uppercase tracking-wider px-8 text-white/70 hover:text-white hover:bg-white/5">
                <Link to="/about">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* What you can do — asymmetric grid */}
      <section className="section-light">
        <div className="container py-20 md:py-28">
          <p className="section-label">Get Involved</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-[#1A1A1A] mb-12 max-w-lg">
            Ways to make a difference.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#1A1A1A]/10">
            {[
              {
                title: "Register",
                desc: "Sign up your team of 4 for dinner and golf. $600 per team.",
                link: "/register",
                cta: "Register Now",
              },
              {
                title: "Dinner Only",
                desc: "Join us for the Thursday evening dinner at the Victoria Inn. $45/ticket.",
                link: "/register#dinner",
                cta: "Get Tickets",
              },
              {
                title: "Sponsor",
                desc: "Get your brand in front of the community and support a great cause.",
                link: "/register#sponsor",
                cta: "View Packages",
              },
              {
                title: "Donate",
                desc: "Every dollar funds research for a cure for Ataxia Telangiectasia.",
                link: "/register#donate",
                cta: "Donate Now",
              },
            ].map((card) => (
              <div key={card.title} className="bg-white p-8 md:p-10 space-y-4">
                <h3 className="font-heading font-bold text-xl text-[#1A1A1A]">{card.title}</h3>
                <p className="text-[#1A1A1A]/60 leading-relaxed text-left">{card.desc}</p>
                <Link
                  to={card.link}
                  className="inline-flex items-center gap-2 text-sm font-heading font-bold text-primary hover:text-[#4A7C09] transition-colors"
                >
                  {card.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Holden — dark section */}
      <section className="section-dark">
        <div className="container py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="section-label">The Story</p>
              <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-white mb-8 leading-tight">
                About Holden
              </h2>
              <p className="text-white/60 leading-relaxed mb-6 text-left">
                Holden Stewart is a vibrant young boy from Brandon, Manitoba, living with Ataxia
                Telangiectasia (A-T), a rare genetic disorder. Despite the challenges, Holden
                approaches each day with infectious optimism and unyielding spirit.
              </p>
              <p className="text-white/60 leading-relaxed mb-8 text-left">
                The Hope 4 Holden tournament raises funds for the ATCP to support research and
                find a cure — because every child deserves a fighting chance.
              </p>
              <Button asChild variant="ghost" className="text-primary hover:text-[#4A7C09] hover:bg-white/5 font-heading font-bold uppercase tracking-wider p-0 h-auto">
                <Link to="/about" className="flex items-center gap-2">
                  Read Holden's Full Story <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="bg-white/5 border border-white/10 p-10 rounded">
              <blockquote className="font-heading font-extrabold text-3xl md:text-4xl text-primary leading-tight mb-4">
                "Beat Disease"
              </blockquote>
              <p className="text-white/40 text-sm font-heading uppercase tracking-wider">— Holden Stewart</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsors section */}
      <section className="section-light">
        <div className="container py-20 md:py-28">
          <p className="section-label">Our Supporters</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-[#1A1A1A] mb-12 max-w-lg">
            Thank you to our sponsors.
          </h2>

          {sponsors.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {sponsors.map((s) => (
                <div key={s.id} className="bg-white p-6 flex flex-col items-center gap-3 border border-[#1A1A1A]/10 rounded">
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.business_name} className="h-16 object-contain" />
                  ) : (
                    <div className="h-16 w-16 bg-[#F5F5F5] rounded flex items-center justify-center text-lg font-heading font-bold text-[#1A1A1A]/30">
                      {s.business_name.charAt(0)}
                    </div>
                  )}
                  <p className="text-sm font-medium text-[#1A1A1A]">{s.business_name}</p>
                  <span className="text-xs text-[#1A1A1A]/40 font-heading uppercase tracking-wider">{s.tier_name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 border-2 border-dashed border-[#1A1A1A]/15 rounded text-center">
              <p className="text-[#1A1A1A]/40 mb-6">Be a part of something meaningful.</p>
              <Button asChild className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider">
                <Link to="/sponsor">Become a Sponsor</Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
