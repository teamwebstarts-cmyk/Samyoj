import { FileText, MessageCircle, TrendingUp } from 'lucide-react';
import WhatsAppGlyph from './icons/WhatsAppGlyph';

const BENEFITS = [
  {
    id: 'trusted',
    title: 'Trusted by billions',
    description: "Connect on the world's most popular app",
    icon: (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm sm:h-11 sm:w-11">
        <WhatsAppGlyph className="h-5 w-5" />
      </span>
    ),
  },
  {
    id: 'engagement',
    title: 'Better engagement',
    description: 'Higher open rates and faster responses',
    icon: (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 sm:h-11 sm:w-11">
        <MessageCircle className="h-5 w-5" strokeWidth={2.1} />
      </span>
    ),
  },
  {
    id: 'cost',
    title: 'Cost effective',
    description: 'Save time and reduce manual work',
    icon: (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 sm:h-11 sm:w-11">
        <FileText className="h-5 w-5" strokeWidth={2.1} />
      </span>
    ),
  },
  {
    id: 'scale',
    title: 'Scalable growth',
    description: 'Tools to grow with your business',
    icon: (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime-100 text-lime-700 sm:h-11 sm:w-11">
        <TrendingUp className="h-5 w-5" strokeWidth={2.1} />
      </span>
    ),
  },
];

export default function PreConnectBenefits() {
  return (
    <section
      aria-label="Why businesses use WhatsApp"
      className="rounded-2xl border border-neutral-100/80 bg-neutral-50/90 p-4 sm:rounded-[1.5rem] sm:p-5 md:rounded-[1.75rem] md:p-6 lg:p-7"
    >
      <h3 className="text-[16px] font-bold tracking-tight text-neutral-900 sm:text-[18px]">
        Why businesses use WhatsApp
      </h3>
      <div className="mt-4 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:mt-5 sm:gap-5 lg:grid-cols-4 lg:gap-4">
        {BENEFITS.map((b) => (
          <div key={b.id} className="flex items-start gap-3 sm:gap-3.5">
            {b.icon}
            <div className="min-w-0 pt-0.5">
              <p className="text-[13.5px] font-bold text-neutral-900 sm:text-[14px]">{b.title}</p>
              <p className="mt-0.5 text-[12px] font-medium leading-snug text-neutral-500 sm:text-[12.5px]">
                {b.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
