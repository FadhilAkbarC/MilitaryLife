import Link from 'next/link';

const links = [
  { href: '/dashboard/career', label: 'Career' },
  { href: '/dashboard/training', label: 'Training' },
  { href: '/dashboard/deployment', label: 'Deployment' },
  { href: '/dashboard/profile', label: 'Profile' },
  { href: '/dashboard/decision-log', label: 'Decision Log' },
  { href: '/dashboard/hierarchy', label: 'Hierarchy V2' },
  { href: '/dashboard/people', label: 'NPC / People' }
];

export function ActionButtons() {
  return (
    <div className="cyber-panel grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 lg:grid-cols-7">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded border border-border bg-bg/70 px-3 py-2 text-center text-xs font-medium text-text transition hover:border-accent sm:text-sm"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
