import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import SortablePhoto from "./SortablePhoto";
import type { GalleryPhoto } from "./types";

interface PhotoGridProps {
  photos: GalleryPhoto[];
  setPhotos: React.Dispatch<React.SetStateAction<GalleryPhoto[]>>;
  loading: boolean;
  fetchPhotos: () => void;
}

export default function PhotoGrid({ photos, setPhotos, loading, fetchPhotos }: PhotoGridProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDelete = async (photo: GalleryPhoto) => {
    const urlParts = photo.photo_url.split("/gallery-photos/");
    const storagePath = urlParts[1];
    if (storagePath) await supabase.storage.from("gallery-photos").remove([storagePath]);

    const { error } = await supabase.from("gallery_photos").delete().eq("id", photo.id);
    if (error) {
      toast({ title: "Error deleting photo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Photo deleted" });
      fetchPhotos();
    }
  };

  const handleCaptionUpdate = async (id: string, newCaption: string) => {
    const { error } = await supabase.from("gallery_photos").update({ caption: newCaption || null }).eq("id", id);
    if (error) {
      toast({ title: "Error updating caption", description: error.message, variant: "destructive" });
    } else {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption: newCaption || null } : p)));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...photos];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Optimistic update
    setPhotos(reordered);

    // Persist new sort orders
    const updates = reordered.map((p, i) => supabase.from("gallery_photos").update({ sort_order: i }).eq("id", p.id));
    const results = await Promise.all(updates);
    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      toast({ title: "Error saving order", variant: "destructive" });
      fetchPhotos();
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  if (photos.length === 0) {
    return (
      <div className="py-16 text-center border-2 border-dashed rounded">
        <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">No photos yet. Upload some above!</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <SortablePhoto key={photo.id} photo={photo} onDelete={handleDelete} onCaptionUpdate={handleCaptionUpdate} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
