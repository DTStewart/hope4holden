import {
  CalendarDays, Clock, MapPin, Car, Shirt, CloudRain, Utensils, Gavel,
  Trophy, Phone, Mail,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

// Static content for the 2026 tournament. Update here any time logistics change.
// All tournament pages link to this from confirmation emails + the footer.

export default function DayOf() {
  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-16 md:py-20 animate-fade-in relative z-10">
          <p className="section-label">June 18–19, 2026</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-white leading-tight mt-1">
            Day-of Info
          </h1>
          <p className="text-white/60 mt-3 text-base max-w-xl">
            Everything you need for a smooth tournament weekend. Bookmark this page.
          </p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-12 md:py-16 max-w-3xl space-y-8">

          {/* Schedule */}
          <div>
            <h2 className="font-heading font-extrabold text-2xl text-foreground mb-4 flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" /> Schedule
            </h2>
            <Card>
              <CardContent className="py-5 divide-y divide-foreground/10">
                <Row icon={Utensils} label="Thursday, June 18 · Dinner + Silent Auction">
                  Doors open at 6:00 PM · Dinner at 6:30 PM · Silent auction closes at 9:00 PM ·
                  Awards + announcements right after.
                </Row>
                <Row icon={Trophy} label="Friday, June 19 · Tournament">
                  Check-in opens at 8:00 AM · Shotgun start at 9:00 AM · Lunch at the turn ·
                  Prize ceremony follows the final round.
                </Row>
              </CardContent>
            </Card>
          </div>

          {/* Venues */}
          <div>
            <h2 className="font-heading font-extrabold text-2xl text-foreground mb-4 flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" /> Where
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Card>
                <CardContent className="py-5 space-y-2">
                  <p className="font-heading font-bold text-foreground">Dinner — Thursday</p>
                  <p className="text-sm text-foreground/70">
                    Victoria Inn, Brandon. Ballroom — watch for signage at the main entrance.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5 space-y-2">
                  <p className="font-heading font-bold text-foreground">Tournament — Friday</p>
                  <p className="text-sm text-foreground/70">
                    Course location and check-in details will be confirmed closer to the event. Watch your inbox.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Logistics */}
          <div>
            <h2 className="font-heading font-extrabold text-2xl text-foreground mb-4">Logistics</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Card>
                <CardContent className="py-5 space-y-2">
                  <p className="font-heading font-bold text-foreground flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" /> Parking
                  </p>
                  <p className="text-sm text-foreground/70">
                    Free parking at both the dinner venue and the course. Carpooling encouraged where you can.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5 space-y-2">
                  <p className="font-heading font-bold text-foreground flex items-center gap-2">
                    <Shirt className="h-4 w-4 text-primary" /> Dress code
                  </p>
                  <p className="text-sm text-foreground/70">
                    Golf attire on the course (collared shirt, golf shoes). Dinner is casual — come as you are.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5 space-y-2">
                  <p className="font-heading font-bold text-foreground flex items-center gap-2">
                    <CloudRain className="h-4 w-4 text-primary" /> Weather
                  </p>
                  <p className="text-sm text-foreground/70">
                    Tournament goes rain or shine. If we need to delay or modify the format, we'll text you the morning-of.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5 space-y-2">
                  <p className="font-heading font-bold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Arrival
                  </p>
                  <p className="text-sm text-foreground/70">
                    Please arrive 30 minutes before your start time for check-in, bag drop, and cart assignment.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Auction */}
          <div>
            <h2 className="font-heading font-extrabold text-2xl text-foreground mb-4 flex items-center gap-2">
              <Gavel className="h-6 w-6 text-primary" /> Silent Auction
            </h2>
            <Card>
              <CardContent className="py-5 text-sm text-foreground/70 space-y-2">
                <p>
                  Bidding opens <strong>June 1</strong> and closes during Thursday's dinner at <strong>9:00 PM</strong>.
                  Bid from anywhere — you don't need to be at the dinner to win. Items are collected Thursday night,
                  Friday at check-in, or arranged with out-of-town winners.
                </p>
                <p>
                  <Link to="/auction" className="text-primary underline font-semibold">Browse items and register to bid →</Link>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Contact */}
          <div>
            <h2 className="font-heading font-extrabold text-2xl text-foreground mb-4">Questions</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Card>
                <CardContent className="py-5 space-y-2">
                  <p className="font-heading font-bold text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" /> Email
                  </p>
                  <a href="mailto:hello@hope4holden.com" className="text-sm text-primary underline">
                    hello@hope4holden.com
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5 space-y-2">
                  <p className="font-heading font-bold text-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" /> Phone
                  </p>
                  <p className="text-sm text-foreground/70">Jill: 204-761-3880</p>
                  <p className="text-sm text-foreground/70">Derrick: 204-761-6955</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <p className="text-xs text-foreground/50 text-center pt-6">
            Details subject to change. We'll email updates if anything shifts. Last updated April 22, 2026.
          </p>
        </div>
      </section>
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="py-4 flex gap-3">
      <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-heading font-bold text-foreground">{label}</p>
        <p className="text-sm text-foreground/70 mt-1">{children}</p>
      </div>
    </div>
  );
}
