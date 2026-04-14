import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ShoppingCart, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import h4hLogo from "@/assets/h4h-logo.png";

const navLinks = [
  { to: "/", label: "Home", icon: true },
  { to: "/tournament", label: "Tournament" },
  { to: "/register", label: "Register" },
  { to: "/sponsor", label: "Sponsor" },
  { to: "/donate", label: "Donate" },
  { to: "/about", label: "About" },
  { to: "/gallery", label: "Gallery" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount, setDrawerOpen } = useCart();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-[#1A1A1A] text-white">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={h4hLogo} alt="Hope 4 Holden" className="h-10 w-auto invert" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-0">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2 text-[13px] font-heading font-semibold uppercase tracking-wider transition-colors ${
                location.pathname === link.to
                  ? "text-primary"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {link.icon ? <Home className="h-4 w-4" /> : link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            className="relative p-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setDrawerOpen(true)}
            aria-label="Shopping cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>

          <button
            className="lg:hidden p-2 text-white/70 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="lg:hidden border-t border-white/10 bg-[#1A1A1A] pb-4">
          <div className="container flex flex-col gap-1 pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`px-3 py-2 text-sm font-heading font-semibold uppercase tracking-wider transition-colors ${
                  location.pathname === link.to
                    ? "text-primary"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
