/** Pre-connect illustration supplied by the product design reference. */
export default function PreConnectScene() {
  return (
    <div
      className="relative mx-auto flex h-[220px] w-full max-w-[640px] items-center justify-center sm:h-[260px] lg:h-[300px] lg:max-w-[720px] xl:h-[320px]"
      aria-hidden
    >
      <img
        src="/dashboard/preconnect-reference.png"
        alt=""
        className="max-h-full w-full select-none object-contain object-center lg:scale-[1.03]"
        draggable={false}
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, #000 9%, #000 100%), linear-gradient(to right, transparent 0%, #000 8%, #000 100%)',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, #000 9%, #000 100%), linear-gradient(to right, transparent 0%, #000 8%, #000 100%)',
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
        }}
      />
    </div>
  );
}
