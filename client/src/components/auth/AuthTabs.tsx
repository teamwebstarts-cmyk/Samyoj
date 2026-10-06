import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Sign in', to: '/login' },
  { label: 'Create account', to: '/register' },
];

export default function AuthTabs() {
  const { pathname } = useLocation();

  return (
    <div className="mb-8 flex gap-6 border-b border-theme-border">
      {tabs.map(({ label, to }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${
              active
                ? 'border-[#732BFD] text-theme-fg dark:border-[#A78BFA]'
                : 'border-transparent text-theme-muted hover:text-theme-fg'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
