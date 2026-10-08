import { Link } from '@tanstack/react-router';
import { LayoutDashboard, Gift, Users, Calendar } from 'lucide-react';

import { GlassPanel } from './ui/glass-panel';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/dashboard/lists', label: 'Lists', icon: Gift, exact: false },
  { to: '/dashboard/groups', label: 'Groups', icon: Users, exact: false },
  { to: '/dashboard/events', label: 'Events', icon: Calendar, exact: false },
] as const;

export default function Nav() {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
      <GlassPanel contentClassName="gap-1 p-1.5">
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="dock-item"
            activeProps={{ className: 'dock-item dock-item--active' }}
          >
            <Icon size={17} />
            <span className="font-body text-[10px] font-semibold">{label}</span>
          </Link>
        ))}
      </GlassPanel>
    </div>
  );
}
