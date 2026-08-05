'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import {
  ADMIN_EMAIL,
  canManageNegocio as canManageNegocioFn,
  isAdminProfile,
  type Profile,
} from '@/lib/auth';
import { syncProfileWithOwnedNegocio } from '@/lib/owned-negocio';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  canManageNegocio: (negocioId: number) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string, email?: string | null) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, role, negocio_id, created_at')
      .eq('id', uid)
      .maybeSingle();

    let next = (data as Profile | null) ?? null;

    if (email?.toLowerCase() === ADMIN_EMAIL) {
      if (!next || next.role !== 'admin') {
        const { data: upserted } = await supabase
          .from('profiles')
          .upsert({ id: uid, email, role: 'admin' })
          .select('id, email, role, negocio_id, created_at')
          .single();
        next = (upserted as Profile) ?? next;
      }
    }

    // Si ya hay negocio por owner_id pero profiles.negocio_id está vacío, enlazarlo
    // (preserva role admin)
    const owned = await syncProfileWithOwnedNegocio(
      supabase,
      uid,
      next?.negocio_id,
      next?.role,
      next?.email ?? email
    );
    if (owned && next && next.negocio_id !== owned.id) {
      const { data: refreshed } = await supabase
        .from('profiles')
        .select('id, email, role, negocio_id, created_at')
        .eq('id', uid)
        .maybeSingle();
      next = (refreshed as Profile | null) ?? {
        ...next,
        negocio_id: owned.id,
        role: next.role === 'admin' || email?.toLowerCase() === ADMIN_EMAIL
          ? 'admin'
          : 'comercio',
      };
    }

    setProfile(next);
  };

  const refreshProfile = async () => {
    const {
      data: { user: current },
    } = await supabase.auth.getUser();
    setUser(current);
    if (current) await loadProfile(current.id, current.email);
    else setProfile(null);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      if (data.user) {
        loadProfile(data.user.id, data.user.email).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        loadProfile(nextUser.id, nextUser.email);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    isAdmin: isAdminProfile(profile),
    canManageNegocio: (negocioId: number) => canManageNegocioFn(profile, negocioId),
    refreshProfile,
    signOut: async () => {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
