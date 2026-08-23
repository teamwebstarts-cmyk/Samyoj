import InfoTip from './InfoTip';

interface FieldInfoTipProps {
  text: string;
}

/** Label-adjacent info icon — same bright white tooltip as InfoTip (no native browser title). */
export default function FieldInfoTip({ text }: FieldInfoTipProps) {
  return <InfoTip content={text} />;
}
