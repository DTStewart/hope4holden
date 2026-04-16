import { useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const selectMode = selected.size > 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === photos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(photos.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);

    const toDelete = photos.filter((p) => selected.has(p.id));
    const storagePaths = toDelete
      .map((p) => { const parts = p.photo_url.split("/gallery-photos/"); return parts[1]; })
      .filter(Boolean);

    if (storagePaths.length > 0) {
      await supabase.storage.from("gallery-photos").remove(storagePaths);
    }

    const ids = toDelete.map((p) => p.id);
    const { error } = await supabase.from("gallery_photos").delete().in("id", ids);

    if (error) {
      toast({ title: "Error deleting photos", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${ids.length} photo(s) deleted` });
    }

    setSelected(new Set());
    setDeleting(false);
    fetchPhotos();
  };

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
    setPhotos(reordered);

    const updates = reordered.map((p, i) => supabase.from("gallery_photos").update({ sort_order: i }).eq("id", p.id));
    const results = await Promise.all(updates);
    if (results.some((r) => r.error)) {
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
    <div className="space-y-3">
      {/* Bulk actions bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selected.size === photos.length}
            onCheckedChange={selectAll}
            aria-label="Select all"
          />
          <span className="text-sm text-muted-foreground">
            {selectMode ? `${selected.size} selected` : "Select"}
          </span>
        </div>
        {selectMode && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4 mr-1" />
            {deleting ? "Deleting..." : `Delete ${selected.size}`}
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <SortablePhoto
                key={photo.id}
                photo={photo}
                onDelete={handleDelete}
                onCaptionUpdate={handleCaptionUpdate}
                selected={selected.has(photo.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
