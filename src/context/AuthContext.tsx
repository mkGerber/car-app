import React, { createContext, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setUser, logout } from "../store/slices/authSlice";
import { auth } from "../services/supabase";

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const {
          data: { user },
        } = await auth.getCurrentUser();
        if (user) {
          dispatch(
            setUser({
              id: user.id,
              email: user.email!,
              username:
                user.user_metadata?.username || user.email!.split("@")[0],
              full_name: user.user_metadata?.full_name,
              avatar_url: user.user_metadata?.avatar_url,
            })
          );
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        dispatch(
          setUser({
            id: session.user.id,
            email: session.user.email!,
            username:
              session.user.user_metadata?.username ||
              session.user.email!.split("@")[0],
            full_name: session.user.user_metadata?.full_name,
            avatar_url: session.user.user_metadata?.avatar_url,
          })
        );
        setIsAuthenticated(true);
      } else if (event === "SIGNED_OUT") {
        dispatch(logout());
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await auth.signIn(email, password);
      if (error) throw error;
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await auth.signUp(email, password);
      if (error) throw error;
    } catch (error) {
      console.error("Sign up error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    isAuthenticated,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
