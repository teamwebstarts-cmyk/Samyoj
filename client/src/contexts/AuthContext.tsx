import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { authApi } from '../services/api';
import type { User, Organization, OrgRole } from '../types';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  orgRole: OrgRole | null;
  canManageTeam: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; companyName: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function applySession(
  setUser: (user: User | null) => void,
  setOrganization: (org: Organization | null) => void,
  user: User | null,
  organization: Organization | null
) {
  setUser(user);
  setOrganization(organization);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authApi
        .me()
        .then(({ data }) => {
          const org = data.data.organizations?.[0];
          applySession(setUser, setOrganization, data.data, org
            ? {
                id: org.id,
                companyName: org.companyName,
                role: org.role,
              }
            : null);
        })
        .catch(() => localStorage.clear())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    applySession(setUser, setOrganization, data.data.user, data.data.organization);
  };

  const register = async (formData: {
    name: string;
    email: string;
    password: string;
    companyName: string;
  }) => {
    const { data } = await authApi.register(formData);
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    applySession(setUser, setOrganization, data.data.user, data.data.organization);
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) authApi.logout(refreshToken);
    localStorage.clear();
    applySession(setUser, setOrganization, null, null);
  };

  const orgRole = organization?.role ?? null;
  const canManageTeam = orgRole === 'OWNER' || orgRole === 'ADMIN';

  const value = useMemo(
    () => ({
      user,
      organization,
      orgRole,
      canManageTeam,
      loading,
      login,
      register,
      logout,
    }),
    [user, organization, orgRole, canManageTeam, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
