import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15s default — increased from 8s to handle auth + data endpoints
  headers: {
    "Content-Type": "application/json",
  },
});

// Separate client for disease prediction — model loading takes 30-60s on first request
export const diseaseApi = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 120s — ConvNeXt-Base (1GB) can take up to 60s to load on first call
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor factory — applies to both api and diseaseApi
const applyInterceptors = (instance: ReturnType<typeof axios.create>) => {
  instance.interceptors.request.use(
    (config) => {
      if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
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
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("agrinexus_token");
        }
      }
      return Promise.reject(error);
    }
  );
};

applyInterceptors(api);
applyInterceptors(diseaseApi);
export default api;
