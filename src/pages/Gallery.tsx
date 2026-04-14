import { Camera } from "lucide-react";

const years = [2024, 2023, 2022];

const GalleryPage = () => {
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
          {years.map((year) => (
            <div key={year}>
              <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A] mb-6">{year}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-[#1A1A1A]/10">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white aspect-square flex items-center justify-center">
                    <Camera className="h-8 w-8 text-[#1A1A1A]/20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GalleryPage;
