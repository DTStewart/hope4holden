interface ChannelDisabledNoticeProps {
  title: string;
  message: string | null;
}

/**
 * Shown in place of a sales section's purchase UI when its sales_channels
 * row has enabled=false. Uses neutral styling — green is reserved for CTAs.
 */
export function ChannelDisabledNotice({ title, message }: ChannelDisabledNoticeProps) {
  return (
    <div className="bg-white p-6 border border-[#1A1A1A]/10 rounded">
      <h3 className="font-heading font-bold text-base text-[#1A1A1A] mb-2">{title}</h3>
      <p className="text-sm text-[#1A1A1A]/70 whitespace-pre-line">
        {message?.trim() || "This option is currently unavailable. Please check back soon."}
      </p>
    </div>
  );
}
