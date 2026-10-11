import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, setCurrentCaregiverId } from "../lib/supabaseClient";
import {
  signInCaregiver,
  signUpCaregiver,
  signOutCaregiver,
  fetchCaregiverProfile,
} from "../lib/authApi";

const AuthContext = createContext(null);

const ONBOARDING_KEY = "continuum_needs_onboarding";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [caregiverProfile, setCaregiverProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboardingState] = useState(false);

  // Persist needsOnboarding in localStorage so it survives page refresh
  const setNeedsOnboarding = useCallback((val) => {
    setNeedsOnboardingState(val);
    if (val) {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } else {
      localStorage.removeItem(ONBOARDING_KEY);
    }
  }, []);

  // Initialize session and restore state
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user && mounted) {
          setSession(currentSession);
          setUser(currentSession.user);
          setCurrentCaregiverId(currentSession.user.id);

          const profile = await fetchCaregiverProfile(currentSession.user.id);
          if (mounted) {
            setCaregiverProfile(profile);
            // Restore onboarding flag from localStorage
            const pendingOnboarding = localStorage.getItem(ONBOARDING_KEY) === "1";
            setNeedsOnboardingState(pendingOnboarding);
          }
        }
      } catch (err) {
        console.warn("[AuthContext] Session restore error:", err.message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      const newUser = newSession?.user || null;
      setUser(newUser);

      if (newUser) {
        setCurrentCaregiverId(newUser.id);
        const profile = await fetchCaregiverProfile(newUser.id);
        if (mounted) setCaregiverProfile(profile);
      } else {
        setCurrentCaregiverId(null);
        if (mounted) {
          setCaregiverProfile(null);
          setNeedsOnboardingState(false);
          localStorage.removeItem(ONBOARDING_KEY);
        }
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      const res = await signInCaregiver({ email, password });
      setUser(res.user);
      setSession(res.session);
      setCaregiverProfile(res.caregiver);
      return res;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email, password, fullName, phone, language) => {
    setIsLoading(true);
    try {
      const res = await signUpCaregiver({ email, password, fullName, phone, language });
      setUser(res.user);
      setSession(res.session);
      setCaregiverProfile(res.caregiver);
      setNeedsOnboarding(true);
      return res;
    } finally {
      setIsLoading(false);
    }
  }, [setNeedsOnboarding]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await signOutCaregiver();
      setUser(null);
      setSession(null);
      setCaregiverProfile(null);
      setCurrentCaregiverId(null);
      setNeedsOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  }, [setNeedsOnboarding]);

  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
  }, [setNeedsOnboarding]);

  return (
    <AuthContext.Provider
      value={{
        user,
        caregiverProfile,
        session,
        isAuthenticated: !!user || !!session,
        isLoading,
        needsOnboarding,
        setNeedsOnboarding,
        completeOnboarding,
        login,
        register,
        logout,
        reloadProfile: async () => {
          if (user?.id) {
            const p = await fetchCaregiverProfile(user.id);
            setCaregiverProfile(p);
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
