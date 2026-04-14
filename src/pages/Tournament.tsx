import { MapPin, Clock, Calendar, Users, Utensils, Trophy } from "lucide-react";
import tournamentHero from "@/assets/tournament-hero.jpg";

const TournamentPage = () => {
  return (
    <div>
      {/* Hero */}
      <section className="section-dark relative overflow-hidden">
        <img
          src={tournamentHero}
          alt="Hope 4 Holden golf tournament group photo"
          className="absolute inset-0 w-full h-full object-cover object-[center_75%] opacity-30"
        />
        <div className="container py-20 md:py-28 animate-fade-in relative z-10">
          <p className="section-label">June 18–19, 2026</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl lg:text-7xl text-white leading-[0.95] max-w-2xl">
            Tournament Info
          </h1>
          <p className="text-white/60 text-lg mt-6 max-w-xl">
            Two days of fun, food, and fundraising in Brandon, Manitoba.
          </p>
        </div>
      </section>

      {/* Schedule */}
      <section className="section-light">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Schedule</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-[#1A1A1A] mb-12">
            Two days, one mission.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#1A1A1A]/10">
            {/* Thursday */}
            <div className="bg-white p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#1A1A1A]">Thursday, June 18</h3>
                  <p className="text-sm text-[#1A1A1A]/50">Victoria Inn, Brandon</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { time: "5:30 PM", event: "Happy Hour" },
                  { time: "6:30 PM", event: "Dinner" },
                  { time: "7:30 PM", event: "Speeches" },
                  { time: "8:00 PM", event: "Party" },
                ].map((item) => (
                  <div key={item.event} className="flex items-center gap-4">
                    <span className="text-sm font-heading font-semibold text-[#1A1A1A]/40 w-20 shrink-0">{item.time}</span>
                    <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-[#1A1A1A] font-medium">{item.event}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Friday */}
            <div className="bg-white p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#1A1A1A]">Friday, June 19</h3>
                  <p className="text-sm text-[#1A1A1A]/50">Glendale Golf Course</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { time: "10:00 AM", event: "Registration" },
                  { time: "10:45 AM", event: "Group Photo & Toast" },
                  { time: "11:00 AM", event: "Shotgun Start" },
                  { time: "5:00 PM", event: "Champions Award & Happy Hour" },
                ].map((item) => (
                  <div key={item.event} className="flex items-center gap-4">
                    <span className="text-sm font-heading font-semibold text-[#1A1A1A]/40 w-20 shrink-0">{item.time}</span>
                    <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-[#1A1A1A] font-medium">{item.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Details — dark */}
      <section className="section-dark">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Details</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-white mb-10">
            What's included.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl">
            <div className="space-y-2">
              <Users className="h-6 w-6 text-primary" />
              <h3 className="font-heading font-bold text-white">Format</h3>
              <p className="text-white/50 text-sm text-left">4-person team scramble. Fun for all skill levels.</p>
            </div>
            <div className="space-y-2">
              <Utensils className="h-6 w-6 text-primary" />
              <h3 className="font-heading font-bold text-white">Includes</h3>
              <p className="text-white/50 text-sm text-left">Dinner Thursday + golf Friday for your team of 4.</p>
            </div>
            <div className="space-y-2">
              <Trophy className="h-6 w-6 text-primary" />
              <h3 className="font-heading font-bold text-white">Cost</h3>
              <p className="text-white/50 text-sm text-left">$600 per team registration.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Venues */}
      <section className="section-light">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Locations</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-[#1A1A1A] mb-12">
            Venues
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#1A1A1A]/10">
            <div className="bg-white p-8 md:p-10 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" />
                <h3 className="font-heading font-bold text-[#1A1A1A]">Victoria Inn, Brandon</h3>
              </div>
              <p className="text-sm text-[#1A1A1A]/50">3550 Victoria Ave, Brandon, MB R7B 2R4</p>
              <p className="text-sm text-[#1A1A1A]/50">Thursday dinner, speeches, and party</p>
            </div>
            <div className="bg-white p-8 md:p-10 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" />
                <h3 className="font-heading font-bold text-[#1A1A1A]">Glendale Golf Course</h3>
              </div>
              <p className="text-sm text-[#1A1A1A]/50">1401 Chicken Rd, Brandon, MB R7A 5Y1</p>
              <p className="text-sm text-[#1A1A1A]/50">Friday golf tournament</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TournamentPage;
