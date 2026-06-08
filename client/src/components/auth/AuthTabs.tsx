import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Sign in', to: '/login' },
  { label: 'Create account', to: '/register' },
];

export default function AuthTabs() {
  const { pathname } = useLocation();

  return (
    <div className="mb-7 grid grid-cols-2 gap-1 rounded-xl border border-theme-border/60 bg-theme-subtle/80 p-1">
      {tabs.map(({ label, to }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`rounded-[10px] px-3 py-2.5 text-center text-[13px] font-semibold transition-all duration-200 ${
              active
                ? 'bg-theme-surface text-theme-fg shadow-sm ring-1 ring-whatsapp-500/20'
                : 'text-theme-secondary hover:bg-theme-surface/50 hover:text-theme-fg'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
