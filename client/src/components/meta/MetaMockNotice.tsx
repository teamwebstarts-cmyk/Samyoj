import { useMetaMock } from '../../contexts/MetaMockContext';

export default function MetaMockNotice() {
  const { enabled } = useMetaMock();
  if (!enabled) return null;
  return (
    <p className="mt-2 rounded-xl border border-[#d7e6fb] bg-[#f3f8ff] px-3 py-2 text-[12px] text-[#3d4f6f]">
      Sample data is on — Meta lists, the notification bell, and the Gmail dashboard, compose, and templates use mock rows until you connect for real.
    </p>
  );
}
