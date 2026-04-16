import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { YEARS, type StagedFile } from "./types";

interface UploadZoneProps {
  onUploadComplete: () => void;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  const [caption, setCaption] = useState("");
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, done: [] as string[] });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newStaged: StagedFile[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      }));
    setStagedFiles((prev) => [...prev, ...newStaged]);
  }, []);

  const removeStaged = (id: string) => {
    setStagedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (stagedFiles.length === 0) return;
    setUploading(true);
    const year = parseInt(selectedYear);
    const total = stagedFiles.length;
    const doneNames: string[] = [];
    setUploadProgress({ current: 0, total, done: [] });

    for (let i = 0; i < stagedFiles.length; i++) {
      const { file } = stagedFiles[i];
      const ext = file.name.split(".").pop();
      const fileName = `${year}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("gallery-photos").upload(fileName, file);
      if (uploadError) {
        toast({ title: `Failed: ${file.name}`, description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage.from("gallery-photos").getPublicUrl(fileName);
      const { error: insertError } = await supabase.from("gallery_photos").insert({
        year,
        caption: caption || null,
        photo_url: urlData.publicUrl,
        sort_order: i,
      });

      if (insertError) {
        toast({ title: `Failed to save ${file.name}`, description: insertError.message, variant: "destructive" });
      } else {
        doneNames.push(file.name);
      }
      setUploadProgress({ current: i + 1, total, done: [...doneNames] });
    }

    toast({ title: `${doneNames.length} photo(s) uploaded`, description: `Added to ${year} gallery.` });
    stagedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setStagedFiles([]);
    setCaption("");
    setUploading(false);
    setUploadProgress({ current: 0, total: 0, done: [] });
    onUploadComplete();
  };

  return (
    <div className="bg-background border rounded p-6 space-y-4">
      <h3 className="font-heading font-bold text-lg">Upload Photos</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <div>
          <Label>Year</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Caption (optional)</Label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Hole 9 group photo" />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
        }`}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Drag & drop photos here, or <span className="text-primary font-medium">click to browse</span>
        </p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} disabled={uploading} />
      </div>

      {/* Staged preview */}
      {stagedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{stagedFiles.length} file(s) ready</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { stagedFiles.forEach((f) => URL.revokeObjectURL(f.preview)); setStagedFiles([]); }}>
                Clear All
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={uploading}>
                <Upload className="h-4 w-4 mr-1" />
                Upload All
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {stagedFiles.map((sf) => (
              <div key={sf.id} className="relative aspect-square rounded overflow-hidden border group">
                <img src={sf.preview} alt={sf.file.name} className="w-full h-full object-cover" />
                {!uploading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeStaged(sf.id); }}
                    className="absolute top-1 right-1 p-0.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Uploading {uploadProgress.current} of {uploadProgress.total}</span>
            <span className="text-muted-foreground">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
          </div>
          <Progress value={(uploadProgress.current / uploadProgress.total) * 100} className="h-2" />
          {uploadProgress.done.length > 0 && (
            <div className="text-xs text-muted-foreground max-h-20 overflow-y-auto">
              {uploadProgress.done.map((name, i) => (
                <span key={i} className="block">✓ {name}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
