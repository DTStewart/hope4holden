import { Link } from "react-router-dom";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Footer = () => {
  const [email, setEmail] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const { error } = await supabase.from("email_subscribers").insert({ email });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already subscribed!", description: "This email is already on our list." });
      } else {
        toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Thank you!", description: "You've been added to our mailing list." });
    }
    setEmail("");
  };

  return (
    <footer className="bg-foreground text-background">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="font-heading font-bold text-xl tracking-tight">
              <span className="text-primary">HOPE</span> 4 Holden
            </Link>
            <p className="text-sm text-background/70">
              Raising funds for the Ataxia Telangiectasia Children's Project to help find a cure.
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h4 className="font-heading font-semibold text-sm uppercase tracking-wider">Quick Links</h4>
            <div className="flex flex-col gap-2 text-sm text-background/70">
              <Link to="/register" className="hover:text-primary transition-colors">Register</Link>
              <Link to="/sponsor" className="hover:text-primary transition-colors">Sponsor</Link>
              <Link to="/donate" className="hover:text-primary transition-colors">Donate</Link>
              <Link to="/about" className="hover:text-primary transition-colors">About</Link>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="font-heading font-semibold text-sm uppercase tracking-wider">Contact</h4>
            <div className="flex flex-col gap-2 text-sm text-background/70">
              <a href="mailto:hello@hope4holden.com" className="hover:text-primary transition-colors">
                hello@hope4holden.com
              </a>
              <span>Jill: 204-761-3880</span>
              <span>Derrick: 204-761-6955</span>
              <a
                href="https://www.atcp.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                ATCP Website →
              </a>
            </div>
          </div>

          {/* Newsletter */}
          <div className="space-y-3">
            <h4 className="font-heading font-semibold text-sm uppercase tracking-wider">Stay Updated</h4>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/10 border-background/20 text-background placeholder:text-background/50"
                required
              />
              <Button type="submit" size="sm" className="shrink-0">
                Join
              </Button>
            </form>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-background/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-background/50">
          <p>© {new Date().getFullYear()} Hope 4 Holden. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with <Heart className="h-3 w-3 text-primary fill-primary" /> for Holden
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
