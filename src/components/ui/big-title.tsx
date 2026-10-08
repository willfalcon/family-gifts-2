import { ReactNode } from 'react';

type Props = {
  title?: string;
  subtitle?: string | ReactNode;
  children?: ReactNode;
  className?: string;
};

export const bigTitleClasses = 'font-display font-bold text-ink tracking-tight text-[clamp(32px,5vw,50px)]';

export function BigTitle({ title, subtitle, children, className }: Props) {
  return (
    <div className={className}>
      <h2 className={bigTitleClasses}>{title ?? children}</h2>
      {subtitle && <p className="font-body text-[15px] text-slate">{subtitle}</p>}
    </div>
  );
}
