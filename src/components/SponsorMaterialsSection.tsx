import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, X, Plus, Copy, Check, Mail, ImageIcon } from "lucide-react";

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

export interface SponsorMaterialsSponsor {
  id: string;
  business_name: string;
  tier_name: string;
  contact_email: string;
  logo_upload_token: string;
  facebook_handle: string | null;
  instagram_handle: string | null;
}

interface FileEntry {
  file: File;
  preview: string;
  label: string;
}

interface Props {
  sponsor: SponsorMaterialsSponsor;
}

export const SponsorMaterialsSection = ({ sponsor }: Props) => {
  const uploadUrl = `${window.location.origin}/sponsor-upload/${sponsor.logo_upload_token}`;

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [facebook, setFacebook] = useState(sponsor.facebook_handle || "");
  const [instagram, setInstagram] = useState(sponsor.instagram_handle || "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [copied, setCopied] = useState(false);
  const [showEmailField, setShowEmailField] = useState(false);
  const [laterEmail, setLaterEmail] = useState(sponsor.contact_email);
  const [sendingEmail, setSendingEmail] = useState(false);

  const validateFile = useCallback((f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) return "Only PNG or JPG files are allowed.";
    if (f.size > MAX_SIZE) return "File exceeds 10MB.";
    return null;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    setValidationError(null);
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const err = validateFile(f);
      if (err) {
        setValidationError(`${f.name}: ${err}`);
        continue;
      }
      setFiles((prev) => [...prev, { file: f, preview: URL.createObjectURL(f), label: "" }]);
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateLabel = (index: number, label: string) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, label } : f)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const uploadedAssets: Array<{ url: string; filename: string; label: string }> = [];

      for (const entry of files) {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/sponsor-upload?token=${encodeURIComponent(sponsor.logo_upload_token)}&filename=${encodeURIComponent(entry.file.name)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": entry.file.type,
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: entry.file,
          }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }
        const { url } = await res.json();
        uploadedAssets.push({ url, filename: entry.file.name, label: entry.label || entry.file.name });
      }

      const { error } = await supabase.functions.invoke("sponsor-upload", {
        body: {
          token: sponsor.logo_upload_token,
          assets: uploadedAssets,
          facebookHandle: facebook,
          instagramHandle: instagram,
        },
      });
      if (error) throw new Error(error.message);

      setFiles((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.preview));
        return [];
      });
      setSaved(true);
      toast({ title: "Saved!", description: "Your sponsor materials have been updated." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(uploadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSendForLater = async () => {
    if (!laterEmail || !laterEmail.includes("@")) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      const recipients = new Set<string>([laterEmail.trim()]);
      // Always also CC the original checkout email so they have it too
      if (sponsor.contact_email) recipients.add(sponsor.contact_email.trim());

      for (const email of recipients) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "sponsor-logo-upload",
            recipientEmail: email,
            idempotencyKey: `sponsor-upload-later-${sponsor.id}-${email}-${Date.now()}`,
            templateData: {
              businessName: sponsor.business_name,
              tierName: sponsor.tier_name,
              uploadUrl,
            },
          },
        });
      }
      toast({
        title: "Email sent!",
        description: `Sent to ${[...recipients].join(", ")}`,
      });
      setShowEmailField(false);
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="bg-white border border-[#1A1A1A]/10 rounded p-6 md:p-8 text-left space-y-6 mt-8">
      <div className="text-center space-y-2">
        <ImageIcon className="h-8 w-8 text-primary mx-auto" />
        <h2 className="font-heading font-extrabold text-xl md:text-2xl text-[#1A1A1A]">
          Sponsor Materials — {sponsor.business_name}
        </h2>
        <p className="text-sm text-[#1A1A1A]/60">
          Upload your logo and confirm your social handles. You can also share or save the upload link for later.
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 bg-[#F5F5F5] border border-[#1A1A1A]/10 rounded p-3">
              <img src={entry.preview} alt="Preview" className="h-14 w-14 object-contain rounded shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-[#1A1A1A]/60 truncate">
                  {entry.file.name} ({(entry.file.size / 1024 / 1024).toFixed(1)} MB)
                </p>
                <input
                  type="text"
                  placeholder="Label (e.g., Primary Logo)"
                  className="w-full text-sm px-2 py-1 border border-[#1A1A1A]/15 rounded bg-white text-[#1A1A1A]"
                  value={entry.label}
                  onChange={(e) => updateLabel(i, e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-[#1A1A1A]/40 hover:text-destructive shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add file picker */}
      <div>
        <label
          htmlFor={`logo-file-${sponsor.id}`}
          className="flex flex-col items-center justify-center border-2 border-dashed border-[#1A1A1A]/20 rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <Plus className="h-7 w-7 text-[#1A1A1A]/50 mb-2" />
          <span className="text-sm text-[#1A1A1A]/60">
            {files.length === 0 ? "Click to add logo / brand files (PNG or JPG, max 10MB)" : "Add more files"}
          </span>
        </label>
        <input
          id={`logo-file-${sponsor.id}`}
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        {validationError && (
          <p className="text-destructive text-xs mt-2">{validationError}</p>
        )}
      </div>

      {/* Social handles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`fb-${sponsor.id}`} className="text-[#1A1A1A] font-medium">
            Facebook Handle
          </Label>
          <Input
            id={`fb-${sponsor.id}`}
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="@yourhandle"
            className="rounded border-[#1A1A1A]/15"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`ig-${sponsor.id}`} className="text-[#1A1A1A] font-medium">
            Instagram Handle
          </Label>
          <Input
            id={`ig-${sponsor.id}`}
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@yourhandle"
            className="rounded border-[#1A1A1A]/15"
          />
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || (files.length === 0 && facebook === (sponsor.facebook_handle || "") && instagram === (sponsor.instagram_handle || ""))}
        className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider"
        size="lg"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
        {saving ? "Saving..." : saved ? "Save more changes" : "Save Sponsor Materials"}
      </Button>

      {/* Share / save for later */}
      <div className="border-t border-[#1A1A1A]/10 pt-6 space-y-4">
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyLink}
            className="w-full rounded border-[#1A1A1A]/20 text-[#1A1A1A]"
          >
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copied!" : "Copy upload link"}
          </Button>
          <p className="text-xs text-[#1A1A1A]/50">
            Share this link with your marketing team if someone else handles your brand assets.
          </p>
        </div>

        <div className="space-y-2">
          {!showEmailField ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEmailField(true)}
              className="w-full rounded border-[#1A1A1A]/20 text-[#1A1A1A]"
            >
              <Mail className="h-4 w-4 mr-2" />
              Save this for later
            </Button>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`later-email-${sponsor.id}`} className="text-[#1A1A1A] font-medium text-sm">
                Send the upload link to:
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`later-email-${sponsor.id}`}
                  type="email"
                  value={laterEmail}
                  onChange={(e) => setLaterEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="rounded border-[#1A1A1A]/15 flex-1"
                />
                <Button
                  type="button"
                  onClick={handleSendForLater}
                  disabled={sendingEmail}
                  className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider"
                >
                  {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                </Button>
              </div>
              <p className="text-xs text-[#1A1A1A]/50">
                We'll email you a link so you can come back to this when you're ready.
                A copy will also be sent to {sponsor.contact_email}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
