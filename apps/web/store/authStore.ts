import { create } from "zustand";
import api from "../lib/api";

export interface UserProfile {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  phone_number: string | null;
  state: string | null;
  is_active: boolean;
  is_superuser: boolean;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<boolean>;
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    phone_number?: string;
    state?: string;
  }) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Start as true to avoid layout flicker
  error: null,

  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      // OAuth2PasswordRequestForm expects x-www-form-urlencoded username and password
      const params = new URLSearchParams();
      params.append("username", email);
      params.append("password", password);

      const res = await api.post("/api/v1/auth/login", params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token } = res.data;
      localStorage.setItem("agrinexus_token", access_token);

      // Immediately fetch user profile
      const userRes = await api.get("/api/v1/auth/me", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      set({
        token: access_token,
        user: userRes.data,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Invalid email or password";
      set({ isLoading: false, error: errMsg });
      return false;
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/api/v1/auth/register", payload);
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Registration failed. Email may already be in use.";
      set({ isLoading: false, error: errMsg });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("agrinexus_token");
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    const token = localStorage.getItem("agrinexus_token");
    if (!token) {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    try {
      const res = await api.get("/api/v1/auth/me");
      set({
        token,
        user: res.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      localStorage.removeItem("agrinexus_token");
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
