import { Link } from '@tanstack/react-router';
import { Gift, Users, Calendar } from 'lucide-react';

import { GlassPanel } from './ui/glass-panel';

const NAV = [
  { key: 'lists', label: 'Lists', icon: Gift },
  { key: 'groups', label: 'Groups', icon: Users },
  { key: 'events', label: 'Events', icon: Calendar },
] as const;

export default function Nav() {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
      <GlassPanel contentClassName="gap-1 p-1.5">
        {NAV.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            to={`/dashboard/${key}`}
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
