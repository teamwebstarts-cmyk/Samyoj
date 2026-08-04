import PreConnectHero from './PreConnectHero';
import PreConnectLearnCards from './PreConnectLearnCards';
import PreConnectBenefits from './PreConnectBenefits';

/** Full Dashboard body when WhatsApp is not connected. */
export default function PreConnectDashboard() {
  return (
    <div className="space-y-6 pb-2 sm:space-y-7 lg:space-y-8">
      <PreConnectHero />
      <PreConnectLearnCards />
      <PreConnectBenefits />
    </div>
  );
}

export function PreConnectSkeleton() {
  return (
    <div className="animate-pulse space-y-6 sm:space-y-7">
      <div className="h-[280px] rounded-[1.75rem] bg-neutral-100/90 sm:h-[320px] sm:rounded-[2rem]" />
      <div>
        <div className="mb-4 h-5 w-40 rounded bg-neutral-100" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-neutral-100/90" />
          ))}
        </div>
      </div>
      <div className="h-36 rounded-[1.5rem] bg-neutral-100/80" />
    </div>
  );
}
