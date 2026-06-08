import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { authApi, teamApi } from '../services/api';
import type { AgentAvailability, User, Organization, OrgRole } from '../types';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  orgRole: OrgRole | null;
  canManageTeam: boolean;
  availability: AgentAvailability | null;
  twoFactorEnabled: boolean;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<{ requires2FA?: boolean }>;
  register: (data: { name: string; email: string; password: string; companyName: string }) => Promise<void>;
  logout: () => void;
  setAvailability: (status: AgentAvailability) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function applySession(
  setUser: (user: User | null) => void,
  setOrganization: (org: Organization | null) => void,
  setAvailability: (a: AgentAvailability | null) => void,
  setTwoFactorEnabled: (v: boolean) => void,
  user: User | null,
  organization: Organization | null,
  availability?: AgentAvailability | null,
  twoFactorEnabled?: boolean
) {
  setUser(user);
  setOrganization(organization);
  setAvailability(availability ?? null);
  setTwoFactorEnabled(twoFactorEnabled ?? false);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [availability, setAvailabilityState] = useState<AgentAvailability | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const heartbeat = useCallback(() => {
    if (!localStorage.getItem('accessToken')) return;
    teamApi.heartbeat().then(({ data }) => {
      setAvailabilityState(data.data.availability);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authApi
        .me()
        .then(({ data }) => {
          const org = data.data.organizations?.[0];
          applySession(
            setUser,
            setOrganization,
            setAvailabilityState,
            setTwoFactorEnabled,
            data.data,
            org
              ? {
                  id: org.id,
                  companyName: org.companyName,
                  role: org.role,
                }
              : null,
            data.data.availability,
            data.data.twoFactorEnabled
          );
          heartbeat();
        })
        .catch(() => localStorage.clear())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [heartbeat]);

  useEffect(() => {
    if (!user) return;
    heartbeat();
    const interval = setInterval(heartbeat, 60_000);
    return () => clearInterval(interval);
  }, [user, heartbeat]);

  const login = async (email: string, password: string, totpCode?: string) => {
    const { data } = await authApi.login({ email, password, totpCode });
    if (data.data.requires2FA) {
      return { requires2FA: true };
    }
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    applySession(
      setUser,
      setOrganization,
      setAvailabilityState,
      setTwoFactorEnabled,
      data.data.user,
      data.data.organization,
      'ONLINE',
      false
    );
    heartbeat();
    return {};
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
    applySession(
      setUser,
      setOrganization,
      setAvailabilityState,
      setTwoFactorEnabled,
      data.data.user,
      data.data.organization,
      'ONLINE',
      false
    );
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) authApi.logout(refreshToken);
    localStorage.clear();
    applySession(setUser, setOrganization, setAvailabilityState, setTwoFactorEnabled, null, null);
  };

  const setAvailability = async (status: AgentAvailability) => {
    const { data } = await teamApi.setAvailability(status);
    setAvailabilityState(data.data.availability);
  };

  const orgRole = organization?.role ?? null;
  const canManageTeam = orgRole === 'OWNER' || orgRole === 'ADMIN';

  const value = useMemo(
    () => ({
      user,
      organization,
      orgRole,
      canManageTeam,
      availability,
      twoFactorEnabled,
      loading,
      login,
      register,
      logout,
      setAvailability,
    }),
    [user, organization, orgRole, canManageTeam, availability, twoFactorEnabled, loading, setAvailability]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
