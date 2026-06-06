import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Sign in', to: '/login' },
  { label: 'Create account', to: '/register' },
];

export default function AuthTabs() {
  const { pathname } = useLocation();

  return (
    <div className="mb-8 grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
      {tabs.map(({ label, to }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`rounded-[10px] px-3 py-2.5 text-center text-[13px] font-semibold transition-all duration-200 ${
              active
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
