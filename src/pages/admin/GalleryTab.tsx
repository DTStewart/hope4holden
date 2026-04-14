import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, Upload, Image as ImageIcon } from "lucide-react";

interface GalleryPhoto {
  id: string;
  year: number;
  caption: string | null;
  photo_url: string;
  sort_order: number;
  created_at: string;
}

const YEARS = [2025, 2024];

export default function GalleryTab() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  const [caption, setCaption] = useState("");
  const [filterYear, setFilterYear] = useState<string>("all");

  const fetchPhotos = async () => {
    let query = supabase
      .from("gallery_photos")
      .select("*")
      .order("year", { ascending: false })
      .order("sort_order", { ascending: true });

    if (filterYear !== "all") {
      query = query.eq("year", parseInt(filterYear));
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error loading photos", description: error.message, variant: "destructive" });
    } else {
      setPhotos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPhotos();
  }, [filterYear]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const year = parseInt(selectedYear);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const fileName = `${year}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery-photos")
        .upload(fileName, file);

      if (uploadError) {
        toast({ title: `Failed to upload ${file.name}`, description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("gallery-photos")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("gallery_photos").insert({
        year,
        caption: caption || null,
        photo_url: urlData.publicUrl,
        sort_order: uploaded,
      });

      if (insertError) {
        toast({ title: "Failed to save photo record", description: insertError.message, variant: "destructive" });
      } else {
        uploaded++;
      }
    }

    toast({ title: `${uploaded} photo(s) uploaded`, description: `Added to ${year} gallery.` });
    setCaption("");
    e.target.value = "";
    setUploading(false);
    fetchPhotos();
  };

  const handleDelete = async (photo: GalleryPhoto) => {
    // Extract storage path from URL
    const urlParts = photo.photo_url.split("/gallery-photos/");
    const storagePath = urlParts[1];

    if (storagePath) {
      await supabase.storage.from("gallery-photos").remove([storagePath]);
    }

    const { error } = await supabase.from("gallery_photos").delete().eq("id", photo.id);
    if (error) {
      toast({ title: "Error deleting photo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Photo deleted" });
      fetchPhotos();
    }
  };

  const handleCaptionUpdate = async (id: string, newCaption: string) => {
    const { error } = await supabase
      .from("gallery_photos")
      .update({ caption: newCaption || null })
      .eq("id", id);

    if (error) {
      toast({ title: "Error updating caption", description: error.message, variant: "destructive" });
    } else {
      setPhotos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, caption: newCaption || null } : p))
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div className="bg-background border rounded p-6 space-y-4">
        <h3 className="font-heading font-bold text-lg">Upload Photos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Caption (optional)</Label>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Hole 9 group photo"
            />
          </div>
          <div>
            <Label htmlFor="gallery-upload" className="cursor-pointer">
              <Button asChild disabled={uploading} className="w-full bg-primary text-primary-foreground hover:bg-accent">
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Choose Files"}
                </span>
              </Button>
            </Label>
            <input
              id="gallery-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{photos.length} photo(s)</span>
      </div>

      {/* Photo grid */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : photos.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded">
          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No photos yet. Upload some above!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="bg-background border rounded overflow-hidden group">
              <div className="aspect-square relative">
                <img
                  src={photo.photo_url}
                  alt={photo.caption || "Gallery photo"}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleDelete(photo)}
                  className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <span className="absolute top-2 left-2 bg-foreground/80 text-background text-xs font-bold px-2 py-0.5 rounded">
                  {photo.year}
                </span>
              </div>
              <div className="p-2">
                <Input
                  defaultValue={photo.caption || ""}
                  placeholder="Add caption..."
                  className="text-xs h-8"
                  onBlur={(e) => {
                    if (e.target.value !== (photo.caption || "")) {
                      handleCaptionUpdate(photo.id, e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
