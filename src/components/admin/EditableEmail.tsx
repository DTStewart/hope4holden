import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface EditableEmailProps {
  /** Table name to update */
  table: "registrations" | "sponsors" | "donations" | "dinners";
  /** Row id */
  id: string;
  /** Column to update on the table */
  column: "captain_email" | "contact_email" | "donor_email" | "guest_email";
  /** Current value */
  value: string;
  /** React-query key to invalidate after save */
  invalidateKey: readonly unknown[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditableEmail({ table, id, column, value, invalidateKey }: EditableEmailProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    if (saving) return;
    const next = draft.trim();
    if (next === value) {
      setEditing(false);
      return;
    }
    if (!EMAIL_RE.test(next)) {
      toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
      setDraft(value);
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await adminSupabase.from(table).update({ [column]: next } as any).eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to update email", description: error.message, variant: "destructive" });
      setDraft(value);
    } else {
      toast({ title: "Email updated", description: next });
      queryClient.invalidateQueries({ queryKey: invalidateKey as unknown[] });
    }
    setEditing(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={onKey}
        disabled={saving}
        className="h-8 text-sm min-w-[180px]"
        type="email"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left hover:underline cursor-text"
      title="Click to edit email"
    >
      {value}
    </button>
  );
}
