import PreConnectHero from './PreConnectHero';
import PreConnectLearnCards from './PreConnectLearnCards';
import PreConnectBenefits from './PreConnectBenefits';

/** Full Dashboard body when WhatsApp is not connected. */
export default function PreConnectDashboard() {
  return (
    <div className="space-y-5 pb-4 sm:space-y-7 sm:pb-2 lg:space-y-8">
      <PreConnectHero />
      <PreConnectLearnCards />
      <PreConnectBenefits />
    </div>
  );
}

export function PreConnectSkeleton() {
  return (
    <div className="animate-pulse space-y-5 sm:space-y-7">
      <div className="h-[240px] rounded-2xl bg-neutral-100/90 sm:h-[320px] sm:rounded-[2rem]" />
      <div>
        <div className="mb-3 h-5 w-36 rounded bg-neutral-100 sm:mb-4 sm:w-40" />
        <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-neutral-100/90 sm:h-40" />
          ))}
        </div>
      </div>
      <div className="h-32 rounded-2xl bg-neutral-100/80 sm:h-36 sm:rounded-[1.5rem]" />
    </div>
  );
}
