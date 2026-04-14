import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Upload, Loader2, AlertCircle, ImageIcon } from "lucide-react";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const MIN_RES = 500;

interface SponsorInfo {
  id: string;
  business_name: string;
  tier_name: string;
  logo_url: string | null;
}

export default function SponsorUpload() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "uploaded" | "already">("loading");
  const [sponsor, setSponsor] = useState<SponsorInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
        if (data.sponsor.logo_url) { setStatus("already"); } else { setStatus("ready"); }
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
      // SVGs don't have pixel dimensions to check
      if (f.type === "image/svg+xml") {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (img.width < MIN_RES || img.height < MIN_RES) {
          resolve(`Image must be at least ${MIN_RES}×${MIN_RES} pixels. Yours is ${img.width}×${img.height}.`);
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve("Could not read image dimensions.");
      img.src = URL.createObjectURL(f);
    });
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setValidationError(null);
    const err = await validateFile(f);
    if (err) {
      setValidationError(err);
      setFile(null);
      setPreview(null);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file || !token || !sponsor) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${sponsor.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("sponsor-logos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("sponsor-logos").getPublicUrl(path);

      const res = await supabase.functions.invoke("sponsor-upload", {
        body: { token, logoUrl: urlData.publicUrl },
      });

      if (res.error) throw new Error("Failed to save logo");

      setStatus("uploaded");
      toast({ title: "Logo uploaded successfully!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
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
            <h1 className="font-heading font-bold text-2xl text-foreground">Logo Already Uploaded</h1>
            <p className="text-muted-foreground">A logo has already been uploaded for <strong>{sponsor.business_name}</strong>.</p>
            {sponsor.logo_url && (
              <img src={sponsor.logo_url} alt="Uploaded logo" className="max-h-32 mx-auto mt-4 object-contain" />
            )}
          </div>
        )}

        {status === "uploaded" && (
          <div className="text-center space-y-4">
            <CheckCircle className="h-14 w-14 text-primary mx-auto" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Thank You!</h1>
            <p className="text-muted-foreground">Your logo has been uploaded and will be reviewed by our team before being published.</p>
          </div>
        )}

        {status === "ready" && sponsor && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <ImageIcon className="h-10 w-10 text-primary mx-auto" />
              <h1 className="font-heading font-bold text-2xl text-foreground">Upload Your Logo</h1>
              <p className="text-muted-foreground">
                <strong>{sponsor.business_name}</strong> — {sponsor.tier_name} Sponsor
              </p>
            </div>

            <div className="bg-card border border-border rounded p-6 space-y-5">
              <div className="bg-muted/50 border border-border rounded p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Logo Guidelines</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Accepted formats: PNG, SVG, or JPG</li>
                  <li>Minimum resolution: 500×500 pixels</li>
                  <li>Maximum file size: 10MB</li>
                  <li><strong>Recommended:</strong> PNG or SVG with a transparent background for best results</li>
                </ul>
              </div>

              <div>
                <label
                  htmlFor="logo-file"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary transition-colors"
                >
                  {preview ? (
                    <img src={preview} alt="Preview" className="max-h-40 object-contain" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to select a file</span>
                    </>
                  )}
                </label>
                <input
                  id="logo-file"
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {file && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                )}
              </div>

              {validationError && (
                <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full rounded bg-primary text-primary-foreground hover:bg-accent font-heading font-bold"
                size="lg"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {uploading ? "Uploading..." : "Submit Logo"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
