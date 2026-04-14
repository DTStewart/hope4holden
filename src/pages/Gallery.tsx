import { Card, CardContent } from "@/components/ui/card";
import { Camera } from "lucide-react";

const years = [2024, 2023, 2022];

const GalleryPage = () => {
  return (
    <div className="container py-12 md:py-20 space-y-12 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="font-heading font-bold text-4xl md:text-5xl">Past Tournaments</h1>
        <p className="text-lg text-muted-foreground">Memories from previous Hope 4 Holden events</p>
      </div>

      {years.map((year) => (
        <div key={year} className="space-y-4">
          <h2 className="font-heading font-bold text-2xl">{year}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden group">
                <CardContent className="p-0 aspect-square bg-secondary flex items-center justify-center">
                  <Camera className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default GalleryPage;
