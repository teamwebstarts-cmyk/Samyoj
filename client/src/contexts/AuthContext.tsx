import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { authApi, teamApi } from '../services/api';
import type { AgentAvailability, User, Organization, OrgRole } from '../types';
import {
  clearAuthBackup,
  clearAuthTokens,
  hasAuthSessionHint,
  isRequestAborted,
  restoreAuthBackupIfNeeded,
  adoptLegacyLocalStorageTokens,
  discardClonedSession,
} from '../utils/authStorage';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  orgRole: OrgRole | null;
  canManageTeam: boolean;
  availability: AgentAvailability | null;
  twoFactorEnabled: boolean;
  loading: boolean;
  login: (
    email: string,
    password: string,
    totpCode?: string
  ) => Promise<{
    requires2FA?: boolean;
    requiresEmailVerification?: boolean;
    mustResetPassword?: boolean;
  }>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    companyName: string;
  }) => Promise<
    | { emailVerificationRequired: true; email: string; smtpConfigured: boolean; message?: string }
    | { emailVerificationRequired: false }
  >;
  logout: () => void;
  setAvailability: (status: AgentAvailability) => Promise<void>;
  refreshSession: () => Promise<boolean>;
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
    if (!user) return;
    teamApi.heartbeat().then(({ data }) => {
      setAvailabilityState(data.data.availability);
    }).catch((err) => {
      if (!isRequestAborted(err)) {
        // keep session; transient heartbeat failures must not log the user out
      }
    });
  }, [user]);

  const hydrateFromMe = useCallback(async () => {
    const { data } = await authApi.me();
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
    clearAuthBackup();
    return true;
  }, []);

  useEffect(() => {
    const boot = async () => {
      restoreAuthBackupIfNeeded();
      adoptLegacyLocalStorageTokens();
      await discardClonedSession();
      clearAuthTokens();

      if (!hasAuthSessionHint() || window.location.pathname.startsWith('/login')) {
        setLoading(false);
        return;
      }

      try {
        await hydrateFromMe();
        heartbeat();
      } catch (err) {
        if (isRequestAborted(err)) {
          setLoading(false);
          return;
        }
        clearAuthTokens();
        clearAuthBackup();
        applySession(setUser, setOrganization, setAvailabilityState, setTwoFactorEnabled, null, null);
      } finally {
        setLoading(false);
      }
    };

    void boot();
  }, [heartbeat, hydrateFromMe]);

  useEffect(() => {
    if (!user) return;
    heartbeat();
    const interval = setInterval(heartbeat, 60_000);
    return () => clearInterval(interval);
  }, [user, heartbeat]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      restoreAuthBackupIfNeeded();
      adoptLegacyLocalStorageTokens();
      void discardClonedSession().then(() => {
        if (!user && hasAuthSessionHint()) {
          void hydrateFromMe().catch(() => {});
        }
      });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [user, hydrateFromMe]);

  const login = async (email: string, password: string, totpCode?: string) => {
    const { data } = await authApi.login({ email, password, totpCode });
    if (data.data.requires2FA) {
      return { requires2FA: true };
    }
    if (data.data.requiresEmailVerification) {
      return { requiresEmailVerification: true };
    }
    clearAuthBackup();
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
    return { mustResetPassword: Boolean(data.data.mustResetPassword) };
  };

  const refreshSession = useCallback(async () => {
    try {
      await hydrateFromMe();
      heartbeat();
      return true;
    } catch {
      return false;
    }
  }, [heartbeat, hydrateFromMe]);

  const register = async (formData: {
    name: string;
    email: string;
    password: string;
    companyName: string;
  }) => {
    const { data } = await authApi.register(formData);
    if (data.data.emailVerificationRequired) {
      return {
        emailVerificationRequired: true as const,
        email: data.data.user?.email as string,
        smtpConfigured: Boolean(data.data.smtpConfigured),
        message: data.data.message as string | undefined,
      };
    }
    clearAuthBackup();
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
    return { emailVerificationRequired: false as const };
  };

  const logout = () => {
    void authApi.logout();
    clearAuthTokens();
    clearAuthBackup();
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
      refreshSession,
    }),
    [user, organization, orgRole, canManageTeam, availability, twoFactorEnabled, loading, setAvailability, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
