import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import heroBg from "@/assets/HOME-1C5A0642.jpg";
import h4hLogo from "@/assets/h4h-logo.png";
import DonationTicker from "@/components/DonationTicker";

const HomePage = () => {
  const [sponsors, setSponsors] = useState<{ id: string; business_name: string; tier_name: string; logo_url: string | null }[]>([]);
  const [rafflePot, setRafflePot] = useState<number | null>(null);

  useEffect(() => {
    anonSupabase
      .from("sponsors_public" as any)
      .select("id, business_name, tier_name, logo_url")
      .then(({ data }: any) => {
        if (data) setSponsors(data);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchPot = async () => {
      try {
        const res = await fetch(
          "https://public-raffles.ca-4.ascendfs.net/rest/v1/wheatkingsraffle.5050central.com/getpot/",
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data?.currentEventPot === "number") {
          setRafflePot(data.currentEventPot);
        }
      } catch {
        // silently ignore — banner still renders without the live total
      }
    };
    fetchPot();
    const interval = setInterval(fetchPot, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      {/* Hero — bold, dark, full-bleed */}
      <section className="relative bg-[#1A1A1A] overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Kids in H4H shirts at the golf tournament" className="w-full h-full object-cover object-[20%_center] md:object-center opacity-50" />
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

      {/* 50/50 Raffle banner — styled after H4H graphic */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(120deg, #1d4e7a 0%, #1f6f8b 45%, #1f9a8a 100%)",
        }}
      >
        {/* H4H repeating texture */}
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-[0.07] pointer-events-none select-none font-display tracking-tighter text-white whitespace-nowrap leading-none"
          style={{ fontSize: "4rem" }}
        >
          <div className="absolute -top-2 -left-10">H4H&nbsp;HOPE4HOLDEN&nbsp;H4H&nbsp;HOPE4HOLDEN&nbsp;H4H&nbsp;HOPE4HOLDEN</div>
          <div className="absolute -bottom-2 -left-10 rotate-180">H4H&nbsp;HOPE4HOLDEN&nbsp;H4H&nbsp;HOPE4HOLDEN&nbsp;H4H&nbsp;HOPE4HOLDEN</div>
        </div>

        <div className="container relative z-10 py-14 md:py-20">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
            {/* Left: graphic-style headline + jackpot */}
            <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
              {/* HOPE4HOLDEN with rule lines */}
              <div className="flex items-center gap-3 mb-3">
                <span className="h-px w-8 bg-white" />
                <span className="font-display tracking-[0.15em] text-white text-sm md:text-base">
                  HOPE4HOLDEN
                </span>
                <span className="h-px w-8 bg-white" />
              </div>

              {/* 50 | 50 split */}
              <div className="flex items-end leading-[0.9] font-display drop-shadow-[0_4px_0_rgba(0,0,0,0.35)]">
                <span className="text-primary text-7xl md:text-8xl lg:text-9xl">50</span>
                <span className="text-white/90 text-7xl md:text-8xl lg:text-9xl mx-1">|</span>
                <span className="text-[#0d0d0d] text-7xl md:text-8xl lg:text-9xl">50</span>
              </div>

              {/* Raffle script */}
              <div className="mt-2 mb-6">
                <span className="font-script italic text-white text-4xl md:text-5xl [text-shadow:_2px_2px_0_#0d0d0d]">
                  Raffle
                </span>
              </div>

              {/* Black brush bar + green jackpot pill, stacked */}
              <div className="flex flex-col items-center md:items-center gap-3">
                <div className="bg-[#0d0d0d] px-6 py-2 rounded-sm -skew-x-3 shadow-md">
                  <span className="inline-block skew-x-3 font-display tracking-[0.15em] text-white text-sm md:text-base">
                    CURRENT JACKPOT OVER
                  </span>
                </div>

                {rafflePot !== null && (
                  <div className="relative inline-block px-8 py-3 md:px-10 md:py-4">
                    <span
                      aria-hidden
                      className="absolute inset-0 bg-primary -skew-x-6 rounded-[40%_60%_45%_55%/55%_45%_60%_40%] shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
                    />
                    <span className="relative font-display tabular-nums text-white text-5xl md:text-6xl lg:text-7xl drop-shadow-[0_3px_0_rgba(0,0,0,0.3)]">
                      ${rafflePot.toLocaleString("en-US")}
                    </span>
                  </div>
                )}
              </div>
            </div>


            {/* Right: CTA button */}
            <div className="shrink-0">
              <a
                href="https://hope4holden5050.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-white text-[#0d0d0d] font-display tracking-[0.1em] uppercase px-10 py-6 md:px-12 md:py-7 text-xl md:text-2xl hover:bg-white/90 hover:scale-105 transition-all shadow-xl border-2 border-white/40"
              >
                Buy 50/50 Tickets
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Recent supporters ticker */}
      <DonationTicker />

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
              {
                title: "Dinner Only",
                desc: "Join us for the Thursday evening dinner at the Victoria Inn. $45/ticket.",
                link: "/register#dinner",
                cta: "Get Tickets",
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

          {sponsors.filter((s) => s.logo_url).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {sponsors
                .filter((s) => s.logo_url)
                .map((s) => (
                  <div key={s.id} className="bg-white aspect-square p-4 flex items-center justify-center border border-[#1A1A1A]/10 rounded">
                    <img src={s.logo_url!} alt={s.business_name} className="max-w-full max-h-full w-auto h-auto object-contain" />
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
