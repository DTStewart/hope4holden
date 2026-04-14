import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GalleryPhoto {
  id: string;
  year: number;
  caption: string | null;
  photo_url: string;
}

const YEARS = [2025, 2024];

const GalleryPage = () => {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("gallery_photos")
      .select("id, year, caption, photo_url")
      .order("year", { ascending: false })
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setPhotos(data);
        setLoading(false);
      });
  }, []);

  const photosByYear = YEARS.map((year) => ({
    year,
    photos: photos.filter((p) => p.year === year),
  }));

  return (
    <div>
      <section className="section-dark">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Memories</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95]">
            Past Tournaments
          </h1>
          <p className="text-white/60 text-lg mt-6">Photos from previous Hope 4 Holden events.</p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-20 md:py-28 space-y-16 animate-fade-in">
          {photosByYear.map(({ year, photos: yearPhotos }) => (
            <div key={year}>
              <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A] mb-6">{year}</h2>
              {yearPhotos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-[#1A1A1A]/10">
                  {yearPhotos.map((photo) => (
                    <div key={photo.id} className="bg-white aspect-square relative overflow-hidden group">
                      <img
                        src={photo.photo_url}
                        alt={photo.caption || `${year} tournament photo`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-[#1A1A1A]/70 px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-sm">{photo.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-[#1A1A1A]/10">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white aspect-square flex items-center justify-center">
                      <Camera className="h-8 w-8 text-[#1A1A1A]/20" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GalleryPage;
