import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  hasCalendarAccess: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  getGoogleAccessToken: () => Promise<string | null>;
  connectGoogleCalendar: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function extractAccessToken(result: { user: User }): string | null {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return credential?.accessToken ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        accessTokenRef.current = null;
        setHasCalendarAccess(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const storeToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setHasCalendarAccess(Boolean(token));
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error(
        "Firebase not configured. Add VITE_FIREBASE_* values to frontend/.env"
      );
    }
    const result = await signInWithPopup(auth, googleProvider);
    storeToken(extractAccessToken(result));
  }, [storeToken]);

  const signOut = useCallback(async () => {
    if (!auth) return;
    storeToken(null);
    await firebaseSignOut(auth);
  }, [storeToken]);

  const getIdToken = useCallback(async () => {
    if (!auth?.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  const connectGoogleCalendar = useCallback(async () => {
    if (!auth?.currentUser) {
      throw new Error("Sign in first to connect Google Calendar.");
    }
    const result = await reauthenticateWithPopup(auth.currentUser, googleProvider);
    const token = extractAccessToken(result);
    if (!token) {
      throw new Error(
        "Google Calendar permission was not granted. Allow calendar access in the Google popup."
      );
    }
    storeToken(token);
    return token;
  }, [storeToken]);

  const getGoogleAccessToken = useCallback(async () => {
    if (!auth?.currentUser) return null;
    if (accessTokenRef.current) return accessTokenRef.current;
    try {
      return await connectGoogleCalendar();
    } catch {
      return null;
    }
  }, [connectGoogleCalendar]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured: isFirebaseConfigured,
        hasCalendarAccess,
        signInWithGoogle,
        signOut,
        getIdToken,
        getGoogleAccessToken,
        connectGoogleCalendar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
