import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Handshake, Heart, ArrowRight } from "lucide-react";

const HomePage = () => {
  return (
    <div>
      {/* Hero */}
      <section className="relative bg-foreground text-background overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground/95 to-primary/20" />
        <div className="container relative py-24 md:py-36 flex flex-col items-center text-center gap-6 animate-fade-in">
          <div className="font-heading font-extrabold text-4xl md:text-6xl lg:text-7xl tracking-tight">
            <span className="text-primary">HOPE</span> 4 Holden
          </div>
          <p className="text-2xl md:text-3xl font-heading font-bold tracking-wide text-primary">
            "Beat Disease"
          </p>
          <p className="text-lg md:text-xl text-background/80 max-w-2xl">
            Charity Golf Tournament — June 18-19, 2026 • Brandon, Manitoba
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/register">Register Your Team</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 border-background/30 text-background hover:bg-background/10">
              <Link to="/about">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Action cards */}
      <section className="container py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
          {[
            {
              icon: Users,
              title: "Register Your Team",
              desc: "Sign up your team of 4 for dinner and golf. $600 per team.",
              link: "/register",
              cta: "Register Now",
            },
            {
              icon: Handshake,
              title: "Become a Sponsor",
              desc: "Support the cause and get your brand in front of the community.",
              link: "/sponsor",
              cta: "View Packages",
            },
            {
              icon: Heart,
              title: "Make a Donation",
              desc: "Every dollar helps fund research for a cure for Ataxia Telangiectasia.",
              link: "/donate",
              cta: "Donate Now",
            },
          ].map((card) => (
            <Card
              key={card.title}
              className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <card.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-heading text-xl">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{card.desc}</p>
                <Button asChild variant="link" className="p-0 h-auto text-primary">
                  <Link to={card.link} className="flex items-center gap-1">
                    {card.cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* About summary */}
      <section className="bg-secondary">
        <div className="container py-16 md:py-24 text-center max-w-3xl mx-auto space-y-6">
          <h2 className="font-heading font-bold text-3xl md:text-4xl">About Hope 4 Holden</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Holden Stewart is a vibrant young boy from Brandon, Manitoba, living with Ataxia
            Telangiectasia (A-T), a rare genetic disorder. The Hope 4 Holden charity golf tournament
            raises funds for the ATCP to support research and find a cure.
          </p>
          <Button asChild variant="outline" size="lg">
            <Link to="/about">
              Learn More About Holden <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Sponsors section */}
      <section className="container py-16 md:py-24 text-center space-y-8">
        <h2 className="font-heading font-bold text-3xl md:text-4xl">Our Sponsors</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          We're grateful to the businesses and individuals who make this event possible.
        </p>
        {/* TODO: Dynamic sponsor logos from Supabase */}
        <div className="py-12 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">Be a part of something meaningful</p>
          <Button asChild>
            <Link to="/sponsor">Become Our First Sponsor</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
