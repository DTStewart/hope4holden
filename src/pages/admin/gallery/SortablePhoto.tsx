import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, GripVertical } from "lucide-react";
import type { GalleryPhoto } from "./types";

interface SortablePhotoProps {
  photo: GalleryPhoto;
  onDelete: (photo: GalleryPhoto) => void;
  onCaptionUpdate: (id: string, caption: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function SortablePhoto({ photo, onDelete, onCaptionUpdate, selected, onToggleSelect }: SortablePhotoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`bg-background border rounded overflow-hidden group ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="aspect-square relative">
        <img src={photo.photo_url} alt={photo.caption || "Gallery photo"} className="w-full h-full object-cover" />
        {/* Checkbox */}
        <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect?.(photo.id)}
            className="bg-background/80 border-foreground/50"
          />
        </div>
        <button
          onClick={() => onDelete(photo)}
          className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete photo"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div
          {...attributes}
          {...listeners}
          className="absolute bottom-2 right-2 p-1 bg-foreground/80 text-background rounded cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <span className="absolute top-2 left-8 bg-foreground/80 text-background text-xs font-bold px-2 py-0.5 rounded ml-1">
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
              onCaptionUpdate(photo.id, e.target.value);
            }
          }}
        />
      </div>
    </div>
  );
}
