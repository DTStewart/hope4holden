import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Upload, Loader2, AlertCircle, ImageIcon, X, Plus } from "lucide-react";

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];


interface SponsorInfo {
  id: string;
  business_name: string;
  tier_name: string;
  logo_url: string | null;
  brand_assets: Array<{ url: string; filename: string; label?: string }>;
}

interface FileEntry {
  file: File;
  preview: string;
  label: string;
}

export default function SponsorUpload() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "uploaded" | "already">("loading");
  const [sponsor, setSponsor] = useState<SponsorInfo | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const validate = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sponsor-upload?token=${token}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        if (!res.ok) { setStatus("invalid"); return; }
        const data = await res.json();
        setSponsor(data.sponsor);
        const assets = data.sponsor.brand_assets || [];
        if (assets.length > 0 || data.sponsor.logo_url) { setStatus("already"); } else { setStatus("ready"); }
      } catch { setStatus("invalid"); }
    };
    validate();
  }, [token]);

  const validateFile = useCallback((f: File): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        resolve("Please upload a PNG, JPG, or SVG file.");
        return;
      }
      if (f.size > MAX_SIZE) {
        resolve("File size exceeds 10MB. Please use a smaller file.");
        return;
      }
      resolve(null);
    });
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    setValidationError(null);

    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const err = await validateFile(f);
      if (err) {
        setValidationError(`${f.name}: ${err}`);
        continue;
      }
      setFiles((prev) => [
        ...prev,
        { file: f, preview: URL.createObjectURL(f), label: "" },
      ]);
    }
    // Reset input so re-selecting the same file works
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateLabel = (index: number, label: string) => {
    setFiles((prev) => prev.map((f, i) => i === index ? { ...f, label } : f));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !token || !sponsor) return;
    setUploading(true);
    try {
      const uploadedAssets: Array<{ url: string; filename: string; label: string }> = [];

      for (const entry of files) {
        // Upload each file through the edge function (service role handles storage)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const uploadRes = await fetch(
          `${supabaseUrl}/functions/v1/sponsor-upload?token=${encodeURIComponent(token)}&filename=${encodeURIComponent(entry.file.name)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": entry.file.type,
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: entry.file,
          }
        );
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || "Upload failed");
        }
        const { url } = await uploadRes.json();
        uploadedAssets.push({
          url,
          filename: entry.file.name,
          label: entry.label || entry.file.name,
        });
      }

      const res = await supabase.functions.invoke("sponsor-upload", {
        body: { token, assets: uploadedAssets },
      });
      if (res.error) throw new Error("Failed to save assets");
      setStatus("uploaded");
      toast({ title: "Assets uploaded successfully!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-lg w-full space-y-6">
        {status === "loading" && (
          <div className="text-center"><Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" /></div>
        )}
        {status === "invalid" && (
          <div className="text-center space-y-4">
            <AlertCircle className="h-14 w-14 text-destructive mx-auto" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Invalid Link</h1>
            <p className="text-muted-foreground">This upload link is invalid or has expired.</p>
          </div>
        )}
        {status === "already" && sponsor && (
          <div className="text-center space-y-4">
            <CheckCircle className="h-14 w-14 text-primary mx-auto" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Assets Already Uploaded</h1>
            <p className="text-muted-foreground">Brand assets have already been uploaded for <strong>{sponsor.business_name}</strong>.</p>
            {sponsor.brand_assets && sponsor.brand_assets.length > 0 && (
              <div className="flex flex-wrap gap-3 justify-center mt-4">
                {sponsor.brand_assets.map((a, i) => (
                  <div key={i} className="text-center">
                    <img src={a.url} alt={a.label || a.filename} className="max-h-24 object-contain rounded border border-border" />
                    <p className="text-xs text-muted-foreground mt-1">{a.label || a.filename}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {status === "uploaded" && (
          <div className="text-center space-y-4">
            <CheckCircle className="h-14 w-14 text-primary mx-auto" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Thank You!</h1>
            <p className="text-muted-foreground">Your brand assets have been uploaded and will be reviewed by our team before being published.</p>
          </div>
        )}
        {status === "ready" && sponsor && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <ImageIcon className="h-10 w-10 text-primary mx-auto" />
              <h1 className="font-heading font-bold text-2xl text-foreground">Upload Brand Assets</h1>
              <p className="text-muted-foreground">
                <strong>{sponsor.business_name}</strong> — {sponsor.tier_name} Sponsor
              </p>
            </div>
            <div className="bg-card border border-border rounded p-6 space-y-5">
              <div className="bg-muted/50 border border-border rounded p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Upload Guidelines</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Accepted formats: PNG, SVG, or JPG</li>
                  <li>Minimum resolution: 500×500 pixels</li>
                  <li>Maximum file size: 10MB per file</li>
                  <li>You can upload multiple files (logo variations, banners, etc.)</li>
                  <li><strong>Recommended:</strong> PNG or SVG with a transparent background for best results</li>
                </ul>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-3">
                  {files.map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 bg-muted/30 border border-border rounded p-3">
                      <img src={entry.preview} alt="Preview" className="h-16 w-16 object-contain rounded shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs text-muted-foreground truncate">{entry.file.name} ({(entry.file.size / 1024 / 1024).toFixed(1)} MB)</p>
                        <input
                          type="text"
                          placeholder="Label (e.g., Primary Logo, Banner)"
                          className="w-full text-sm px-2 py-1 border border-border rounded bg-background text-foreground placeholder:text-muted-foreground"
                          value={entry.label}
                          onChange={(e) => updateLabel(i, e.target.value)}
                        />
                      </div>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add file button */}
              <div>
                <label htmlFor="logo-file" className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors">
                  <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    {files.length === 0 ? "Click to select files" : "Add more files"}
                  </span>
                </label>
                <input id="logo-file" type="file" accept=".png,.jpg,.jpeg,.svg" multiple className="hidden" onChange={handleFileChange} />
              </div>

              {validationError && (
                <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
              <Button onClick={handleUpload} disabled={files.length === 0 || uploading} className="w-full rounded bg-primary text-primary-foreground hover:bg-accent font-heading font-bold" size="lg">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Uploading..." : `Submit ${files.length} Asset${files.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
