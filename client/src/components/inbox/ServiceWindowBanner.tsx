import { Link } from 'react-router-dom';
import { Clock, Lock } from 'lucide-react';
import { formatWindowExpiry } from './inboxUtils';
import type { ServiceWindowInfo } from '../../types';

interface ServiceWindowBannerProps {
  serviceWindow: ServiceWindowInfo;
}

export default function ServiceWindowBanner({ serviceWindow }: ServiceWindowBannerProps) {
  if (serviceWindow.open) return null;

  return (
    <div className="border-t border-amber-200/80 bg-gradient-to-r from-amber-50/95 to-orange-50/60 px-3 py-3 sm:px-4">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/60">
          <Lock className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-amber-950">Customer service window closed</p>
          <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-amber-900/85">
            Free-text replies are only available within 24 hours of the customer&apos;s last message.
            {serviceWindow.lastInboundAt
              ? ' Wait for them to message again, or send an approved template.'
              : ' The customer must message you first, or use an approved template.'}
          </p>
          <Link
            to="/campaigns"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-whatsapp-700 hover:text-whatsapp-800"
          >
            Send template via campaign →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ServiceWindowBadge({ serviceWindow }: ServiceWindowBannerProps) {
  if (serviceWindow.open) {
    return (
      <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 sm:flex">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-500 opacity-50" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
        </span>
        <Clock className="h-3 w-3 text-whatsapp-600" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-whatsapp-700">
          {formatWindowExpiry(serviceWindow.expiresAt) || 'Window open'}
        </span>
      </div>
    );
  }

  return (
    <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 sm:flex">
      <Lock className="h-3 w-3 text-amber-700" />
      <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Window closed</span>
    </div>
  );
}
