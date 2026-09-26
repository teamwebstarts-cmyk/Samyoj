import { useMetaMock } from '../../contexts/MetaMockContext';

export default function MetaMockNotice() {
  const { enabled } = useMetaMock();
  if (!enabled) return null;
  return (
    <p className="mt-2 rounded-xl border border-[#d7e6fb] bg-[#f3f8ff] px-3 py-2 text-[12px] text-[#3d4f6f]">
      Sample rows are on — live Meta data still appears in these lists when it arrives.
    </p>
  );
}
