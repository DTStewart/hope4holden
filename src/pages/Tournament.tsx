import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Calendar, Users, Utensils, Trophy } from "lucide-react";

const TournamentPage = () => {
  return (
    <div className="container py-12 md:py-20 max-w-5xl mx-auto space-y-16 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="font-heading font-bold text-4xl md:text-5xl">Tournament Info</h1>
        <p className="text-lg text-muted-foreground">
          Two days of fun, food, and fundraising — June 18-19, 2026
        </p>
      </div>

      {/* Event Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Thursday */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="bg-primary/5">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="font-heading text-xl">Thursday, June 18</CardTitle>
                <p className="text-sm text-muted-foreground">Dinner at the Victoria Inn</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {[
              { time: "5:30 PM", event: "Happy Hour", icon: Utensils },
              { time: "6:30 PM", event: "Dinner", icon: Utensils },
              { time: "7:30 PM", event: "Speeches", icon: Users },
              { time: "8:00 PM", event: "Party", icon: Trophy },
            ].map((item) => (
              <div key={item.event} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-24 shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{item.time}</span>
                </div>
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <span className="font-medium">{item.event}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Friday */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="bg-primary/5">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="font-heading text-xl">Friday, June 19</CardTitle>
                <p className="text-sm text-muted-foreground">Golf at Glendale Golf Course</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {[
              { time: "10:00 AM", event: "Registration", icon: Users },
              { time: "10:45 AM", event: "Group Photo & Toast", icon: Users },
              { time: "11:00 AM", event: "Shotgun Start", icon: Trophy },
              { time: "5:00 PM", event: "Champions Award & Happy Hour", icon: Trophy },
            ].map((item) => (
              <div key={item.event} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-24 shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{item.time}</span>
                </div>
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <span className="font-medium">{item.event}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Event details */}
      <div className="bg-secondary rounded-xl p-8 space-y-4">
        <h2 className="font-heading font-bold text-2xl">Event Details</h2>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <span><strong>Format:</strong> 4-person team scramble</span>
          </li>
          <li className="flex items-start gap-3">
            <Utensils className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <span><strong>Includes:</strong> Dinner on Thursday evening and golf on Friday for your team of 4</span>
          </li>
          <li className="flex items-start gap-3">
            <Trophy className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <span><strong>Registration Fee:</strong> $600 per team</span>
          </li>
        </ul>
      </div>

      {/* Venues */}
      <div className="space-y-6">
        <h2 className="font-heading font-bold text-2xl text-center">Venues</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-heading font-semibold text-lg">Victoria Inn, Brandon</h3>
              </div>
              <p className="text-sm text-muted-foreground">3550 Victoria Ave, Brandon, MB R7B 2R4</p>
              <p className="text-sm text-muted-foreground">Thursday dinner, speeches, and party</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-heading font-semibold text-lg">Glendale Golf Course, Brandon</h3>
              </div>
              <p className="text-sm text-muted-foreground">1401 Chicken Rd, Brandon, MB R7A 5Y1</p>
              <p className="text-sm text-muted-foreground">Friday golf tournament</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TournamentPage;
