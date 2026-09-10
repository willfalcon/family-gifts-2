import { ReactNode } from 'react';

type Props = {
  title?: string;
  subtitle?: string | ReactNode;
  children?: ReactNode;
  className?: string;
};

export function BigTitle({ title, subtitle, children, className }: Props) {
  return (
    <div className={className}>
      <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight text-[clamp(32px,5vw,50px)]">{title ?? children}</h2>
      {subtitle && <p className="font-body text-[15px] text-slate mt-2.5">{subtitle}</p>}
    </div>
  );
}
