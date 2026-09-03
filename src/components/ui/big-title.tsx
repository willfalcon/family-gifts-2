type Props = {
  title: string;
  subtitle?: string;
};

export function BigTitle({ title, subtitle }: Props) {
  return (
    <div className="mb-8">
      <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight text-[clamp(32px,5vw,50px)]">{title}</h2>
      {subtitle && <h3 className="font-body text-[15px] text-slate mt-2.5">{subtitle}</h3>}
    </div>
  );
}
