import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, setCurrentCaregiverId } from "../lib/supabaseClient";
import {
  signInCaregiver,
  signUpCaregiver,
  signOutCaregiver,
  fetchCaregiverProfile,
} from "../lib/authApi";
import { createPatient } from "../lib/patientApi";
import { createInvitation, acceptInvitation } from "../lib/invitationApi";

const AuthContext = createContext(null);

const ONBOARDING_KEY = "continuum_needs_onboarding";

const safeStorage =
  typeof window !== "undefined" && window.sessionStorage
    ? window.sessionStorage
    : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };

async function applyPendingSetup(caregiverId) {
  if (!caregiverId) return null;
  const raw = safeStorage.getItem("continuum_pending_setup");
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw);
    if (pending.type === "new_patient" && pending.patientData) {
      const patient = await createPatient({
        ...pending.patientData,
        caregiverId,
      });
      safeStorage.removeItem("continuum_pending_setup");
      return { type: "new_patient", patient };
    } else if (pending.type === "join_circle" && pending.token) {
      const res = await acceptInvitation(pending.token, caregiverId, pending.relationship);
      safeStorage.removeItem("continuum_pending_setup");
      return { type: "join_circle", ...res };
    }
  } catch (err) {
    console.warn("[AuthContext] Could not auto-apply pending setup:", err);
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [caregiverProfile, setCaregiverProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboardingState] = useState(false);

  // Persist needsOnboarding in sessionStorage so it stays scoped to this tab
  const setNeedsOnboarding = useCallback((val) => {
    setNeedsOnboardingState(val);
    if (val) {
      safeStorage.setItem(ONBOARDING_KEY, "1");
    } else {
      safeStorage.removeItem(ONBOARDING_KEY);
    }
  }, []);

  // Initialize session and restore state
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser && mounted) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          setSession(currentSession);
          setUser(currentUser);
          const profile = await fetchCaregiverProfile(currentUser.id, currentUser.email);
          setCurrentCaregiverId(profile?.caregiver_id || null);
          if (mounted) {
            setCaregiverProfile(profile);
            if (profile?.caregiver_id) {
              await applyPendingSetup(profile.caregiver_id);
            }
            // Do not force onboarding loop on session restore; database membership determines onboarding
            setNeedsOnboardingState(false);
            safeStorage.removeItem(ONBOARDING_KEY);
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
        const profile = await fetchCaregiverProfile(newUser.id, newUser.email);
        setCurrentCaregiverId(profile?.caregiver_id || null);
        if (mounted) {
          setCaregiverProfile(profile);
          if (profile?.caregiver_id) {
            await applyPendingSetup(profile.caregiver_id);
          }
        }
      } else {
        setCurrentCaregiverId(null);
        if (mounted) {
          setCaregiverProfile(null);
          setNeedsOnboardingState(false);
          safeStorage.removeItem(ONBOARDING_KEY);
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
      if (res.caregiver?.caregiver_id) {
        await applyPendingSetup(res.caregiver.caregiver_id);
      }
      // Determine onboarding status from database membership result in PatientContext, not flags
      setNeedsOnboarding(false);
      return res;
    } finally {
      setIsLoading(false);
    }
  }, [setNeedsOnboarding]);

  const register = useCallback(async (email, password, fullName, phone, language) => {
    setIsLoading(true);
    try {
      const res = await signUpCaregiver({ email, password, fullName, phone, language });
      if (res.session) {
        setUser(res.user);
        setSession(res.session);
        setCaregiverProfile(res.caregiver);
        setNeedsOnboarding(!res.caregiver);
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  }, [setNeedsOnboarding]);

  const registerWithSetup = useCallback(async ({
    email,
    password,
    fullName,
    phone,
    language,
    setupType,
    patientData,
    joinData,
  }) => {
    setIsLoading(true);
    try {
      const res = await signUpCaregiver({ email, password, fullName, phone, language });
      if (res.session && res.caregiver) {
        setUser(res.user);
        setSession(res.session);
        setCaregiverProfile(res.caregiver);
        setCurrentCaregiverId(res.caregiver.caregiver_id);

        let createdPatient = null;
        let generatedInvite = null;

        if (setupType === "new_patient" && patientData) {
          createdPatient = await createPatient({
            ...patientData,
            caregiverId: res.caregiver.caregiver_id,
          });
          try {
            generatedInvite = await createInvitation({
              patientId: createdPatient.patient_id,
              invitedBy: res.caregiver.caregiver_id,
              relationship: "Family Member",
              role: "family",
            });
          } catch (invErr) {
            console.warn("[AuthContext] Auto-invite creation warning:", invErr);
          }
        } else if (setupType === "join_circle" && joinData?.token) {
          await acceptInvitation(joinData.token, res.caregiver.caregiver_id, joinData.relationship);
        }

        setNeedsOnboarding(false);
        return { ...res, patient: createdPatient, invite: generatedInvite };
      } else if (res.needsEmailConfirmation) {
        safeStorage.setItem(
          "continuum_pending_setup",
          JSON.stringify({
            type: setupType,
            patientData,
            token: joinData?.token,
            relationship: joinData?.relationship,
            email,
          })
        );
        return res;
      }
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
        registerWithSetup,
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
