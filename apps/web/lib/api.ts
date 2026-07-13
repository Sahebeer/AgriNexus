import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to inject JWT token and dynamically adjust backend API URL for host IP access
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      // Adjust backend URL dynamically if accessing from a non-localhost IP on local network
      if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.includes("vercel.app")) {
        config.baseURL = `http://${hostname}:8000`;
      }
      
      let token = null;
      try {
        token = localStorage.getItem("agrinexus_token");
      } catch (e) {
        console.warn("LocalStorage access restricted:", e);
      }
      
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle global response errors (e.g. 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("agrinexus_token");
        // Optional redirect to login can be done here or handled by AuthProvider
      }
    }
    return Promise.reject(error);
  }
);
export default api;
