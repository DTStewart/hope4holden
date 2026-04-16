import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import UploadZone from "./gallery/UploadZone";
import PhotoGrid from "./gallery/PhotoGrid";
import { YEARS, type GalleryPhoto } from "./gallery/types";

export default function GalleryTab() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<string>("all");

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("gallery_photos")
        .select("*")
        .order("year", { ascending: false })
        .order("sort_order", { ascending: true });

      if (filterYear !== "all") {
        query = query.eq("year", parseInt(filterYear));
      }

      const { data, error, status } = await query;

      if (error) {
        console.error("[GalleryTab] fetchPhotos error:", { message: error.message, code: error.code, details: error.details, hint: error.hint, status });
        toast({ title: "Error loading photos", description: error.message, variant: "destructive" });
      } else {
        console.log(`[GalleryTab] Loaded ${data?.length ?? 0} photos (filter: ${filterYear})`);
        setPhotos(data || []);
      }
    } catch (err) {
      console.error("[GalleryTab] fetchPhotos unexpected error:", err);
      toast({ title: "Unexpected error loading photos", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPhotos();
  }, [filterYear]);

  return (
    <div className="space-y-6">
      <UploadZone onUploadComplete={fetchPhotos} />

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{photos.length} photo(s)</span>
      </div>

      <PhotoGrid photos={photos} setPhotos={setPhotos} loading={loading} fetchPhotos={fetchPhotos} />
    </div>
  );
}
