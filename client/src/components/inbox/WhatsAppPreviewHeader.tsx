import { BadgeCheck, Building2, ChevronLeft, MoreVertical } from 'lucide-react';
import { useWhatsAppPreviewIdentity } from '../../hooks/useWhatsAppPreviewIdentity';
import type { WhatsAppPreviewIdentity } from '../../utils/whatsappPreviewIdentity';

interface WhatsAppPreviewHeaderProps {
  compact?: boolean;
  identity?: WhatsAppPreviewIdentity;
}

export default function WhatsAppPreviewHeader({ compact = false, identity }: WhatsAppPreviewHeaderProps) {
  const live = useWhatsAppPreviewIdentity();
  const resolved = identity ?? live;
  const avatarSize = compact ? 'h-7 w-7 text-[9px]' : 'h-8 w-8 text-[10px]';
  const titleSize = compact ? 'text-[12px]' : 'text-[13px]';
  const subtitleSize = compact ? 'text-[9px]' : 'text-[10px]';

  return (
    <div
      className={`flex items-center gap-2 bg-[#008069] text-white ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
      role="group"
      aria-label={`${resolved.title}${resolved.subtitle ? `, ${resolved.subtitle}` : ''}`}
    >
      <ChevronLeft className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 opacity-80`} aria-hidden />
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-white/18 font-extrabold tracking-wide ${avatarSize}`}
        aria-hidden
      >
        {resolved.initials ? (
          resolved.initials
        ) : (
          <Building2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.25} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1 truncate font-semibold leading-tight ${titleSize}`}>
          <span className="truncate">{resolved.title}</span>
          {resolved.showOfficialBadge ? (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-200" aria-label="Official business account" />
          ) : null}
        </p>
        {resolved.subtitle ? (
          <p className={`truncate font-medium leading-tight text-white/75 ${subtitleSize}`}>{resolved.subtitle}</p>
        ) : null}
      </div>
      <MoreVertical className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 opacity-70`} aria-hidden />
    </div>
  );
}
