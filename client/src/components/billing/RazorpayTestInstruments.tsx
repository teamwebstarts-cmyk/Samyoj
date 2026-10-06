/** Official Razorpay test-mode instruments. Real cards and real UPI IDs are declined while the key is rzp_test_. */
const ROWS = [
  { method: 'UPI', value: 'success@razorpay', note: 'Payment succeeds' },
  { method: 'UPI fail', value: 'failure@razorpay', note: 'Payment fails' },
  { method: 'Visa', value: '4100 2800 0000 1007', note: 'Any CVV, any future expiry' },
  { method: 'Mastercard', value: '5555 5100 0008 1006', note: 'Any CVV, any future expiry' },
  { method: 'Subscription Visa', value: '4384 7968 2770 3274', note: 'Mandate auth on a plan' },
  { method: 'Subscription Mastercard', value: '5312 6865 5677 9641', note: 'Mandate auth on a plan' },
] as const;

export default function RazorpayTestInstruments() {
  return (
    <section className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-3 text-[13px] text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-bold">Razorpay test mode</p>
      <p className="mt-1 text-[12px] font-medium leading-relaxed text-amber-900/90 dark:text-amber-100/80">
        Checkout now offers UPI, cards, and netbanking. This key does not charge real accounts. Use a test instrument below. Card OTP can be 1234. For netbanking, pick any bank and press Success.
      </p>
      <dl className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {ROWS.map((row) => (
          <div key={row.value} className="rounded-lg bg-white/70 px-2.5 py-1.5 dark:bg-black/20">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {row.method}
            </dt>
            <dd className="font-mono text-[12px] font-semibold">{row.value}</dd>
            <dd className="text-[11px] text-amber-800/80 dark:text-amber-200/70">{row.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
