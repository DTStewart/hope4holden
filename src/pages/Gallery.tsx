import { useEffect, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import galleryHero from "@/assets/GALLERY-Tournament_Group.jpg";

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
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const { data, error } = await supabase
          .from("gallery_photos")
          .select("id, year, caption, photo_url")
          .order("year", { ascending: false })
          .order("sort_order", { ascending: true });
        
        if (error) {
          console.error("Gallery fetch error:", error);
        }
        if (data) {
          console.log("Gallery photos loaded:", data.length);
          setPhotos(data);
        }
      } catch (err) {
        console.error("Gallery fetch exception:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPhotos();
  }, []);

  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));
      if (e.key === "ArrowLeft") setLightbox((i) => (i !== null && i > 0 ? i - 1 : i));
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [lightbox, photos.length]);

  const photosByYear = YEARS.map((year) => ({
    year,
    photos: photos.filter((p) => p.year === year),
  }));

  const allPhotos = photosByYear.flatMap(({ photos: yp }) => yp);
  const getLightboxIndex = (photo: GalleryPhoto) => allPhotos.findIndex((p) => p.id === photo.id);

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <img src={galleryHero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="container py-20 md:py-28 animate-fade-in relative z-10">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
                  {yearPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      className="aspect-square relative overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                      onClick={() => setLightbox(getLightboxIndex(photo))}
                    >
                      <img
                        src={photo.photo_url}
                        alt={photo.caption || `${year} tournament photo`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-[#1A1A1A]/70 px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-sm">{photo.caption}</p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-white aspect-square flex items-center justify-center border">
                      <Camera className="h-8 w-8 text-[#1A1A1A]/20" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox !== null && allPhotos[lightbox] && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-10"
            onClick={() => setLightbox(null)}
            aria-label="Close lightbox"
          >
            <X className="h-7 w-7" />
          </button>

          {lightbox > 0 && (
            <button
              className="absolute left-2 md:left-6 text-white/60 hover:text-white p-2 z-10"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          {lightbox < allPhotos.length - 1 && (
            <button
              className="absolute right-2 md:right-6 text-white/60 hover:text-white p-2 z-10"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              aria-label="Next photo"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          <div
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={allPhotos[lightbox].photo_url}
              alt={allPhotos[lightbox].caption || "Gallery photo"}
              className="max-w-full max-h-[80vh] object-contain rounded"
            />
            {allPhotos[lightbox].caption && (
              <p className="text-white/80 text-sm mt-3 text-center">{allPhotos[lightbox].caption}</p>
            )}
            <p className="text-white/40 text-xs mt-1">
              {lightbox + 1} / {allPhotos.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryPage;
