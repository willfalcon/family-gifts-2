import { GlassPanel } from './glass-panel';

export function Wordmark() {
  return (
    <div className="fixed top-5 left-7 z-20">
      <GlassPanel contentClassName="items-center gap-2 py-2 pl-3 pr-4">
        <div className="w-[18px] h-[18px] rounded-full border-[2.5px] border-ink" />
        <span className="font-display font-bold text-[15px] text-ink">Family Gifts</span>
      </GlassPanel>
    </div>
  );
}
