"use client";

import React, { useState, useEffect, useRef } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { 
  ArrowLeft, 
  Bot, 
  Send, 
  Plus, 
  MessageSquare, 
  Trash2, 
  Activity, 
  User, 
  Sparkles,
  RefreshCw,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  CloudSun,
  Coins,
  Sprout,
  Compass
} from "lucide-react";

interface Message {
  id: number;
  session_id: string;
  sender: string;
  content: string;
}

interface ChatSession {
  session_id: string;
  session_title: string;
}

interface AdvisorModuleProps {
  onBack?: () => void;
}

export default function AdvisorModule({ onBack }: AdvisorModuleProps) {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [weatherData, setWeatherData] = useState<any>(null);
  const [marketPrices, setMarketPrices] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchContextData = async () => {
      try {
        const weatherRes = await api.get("/api/v1/weather/forecast");
        setWeatherData(weatherRes.data);
      } catch (e) {
        console.error("Failed to load weather context for advisor:", e);
      }
      try {
        const priceRes = await api.get("/api/v1/prices/market");
        setMarketPrices(priceRes.data);
      } catch (e) {
        console.error("Failed to load prices context for advisor:", e);
      }
    };
    fetchContextData();
  }, []);

  const fetchSessions = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get("/api/v1/advisor/sessions");
      setSessions(res.data);
      if (res.data.length > 0 && !activeSessionId) {
        selectSession(res.data[0].session_id);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const selectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    try {
      const res = await api.get(`/api/v1/advisor/sessions/${sessionId}`);
      setMessages(res.data);
    } catch {
      showToast("Unable to load chat session messages", "error");
    }
  };

  const handleCreateNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/v1/advisor/sessions/${sessionId}`);
      showToast("Consultation removed", "info");
      if (activeSessionId === sessionId) {
        handleCreateNewSession();
      }
      fetchSessions();
    } catch {
      showToast("Failed to delete consultation", "error");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isGenerating) return;

    const userText = inputMessage;
    setInputMessage("");

    const tempUserMsg: Message = {
      id: Date.now(),
      session_id: activeSessionId || "temp",
      sender: "user",
      content: userText
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsGenerating(true);

    try {
      const res = await api.post("/api/v1/advisor/chat", {
        message: userText,
        session_id: activeSessionId || undefined
      });

      const data = res.data;
      if (!activeSessionId) {
        setActiveSessionId(data.session_id);
        fetchSessions();
      }

      const botMsg: Message = {
        id: Date.now() + 1,
        session_id: data.session_id,
        sender: "bot",
        content: data.response
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Agronomist inference failure. Please verify connection.";
      showToast(errMsg, "error");
      const fallbackMsg: Message = {
        id: Date.now() + 1,
        session_id: activeSessionId || "temp",
        sender: "bot",
        content: "⚠️ " + errMsg
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const setPrompt = (text: string) => {
    setInputMessage(text);
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header Banner */}
      <div className="clean-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              AI Agronomist Consultation Hub
            </h1>
            <p className="text-xs text-slate-500">Multi-lingual crop pathology, pest control & fertilizer advisory hub</p>
          </div>
        </div>
        <button
          onClick={handleCreateNewSession}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Consultation</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[72vh] min-h-[550px]">
        {/* Left Sidebar: Session History */}
        <div className="lg:col-span-4 clean-card p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
              Consultation History
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 py-3 pr-1">
            {isLoadingHistory ? (
              <div className="flex justify-center py-8"><RefreshCw className="h-4 w-4 animate-spin text-emerald-600" /></div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No previous sessions found.</div>
            ) : (
              sessions.map((s) => {
                const isSelected = activeSessionId === s.session_id;
                return (
                  <div
                    key={s.session_id}
                    onClick={() => selectSession(s.session_id)}
                    className={`p-3 rounded-xl cursor-pointer text-xs font-semibold flex items-center justify-between group transition-all border ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-300 text-emerald-950 shadow-sm"
                        : "border-slate-100 bg-slate-50/50 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span className="truncate flex-1">{s.session_title || "Field Consultation"}</span>
                    <button
                      onClick={(e) => handleDeleteSession(s.session_id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 text-slate-400 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Context Strip */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Agronomy Context</span>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1"><CloudSun className="h-3.5 w-3.5 text-amber-500" /> Weather:</span>
              <span className="font-semibold text-slate-800">{weatherData?.temperature ? `${weatherData.temperature}°C` : "29°C"}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-emerald-600" /> Mandi Rates:</span>
              <span className="font-semibold text-slate-800">{marketPrices.length > 0 ? `${marketPrices.length} Active` : "12 Tracked"}</span>
            </div>
          </div>
        </div>

        {/* Right Chat Area */}
        <div className="lg:col-span-8 clean-card p-4 md:p-6 flex flex-col h-full overflow-hidden">
          {/* Messages Scroll View */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-8">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">How can I assist your crop today?</h3>
                  <p className="text-xs text-slate-500 max-w-md mt-1">
                    Ask questions about fertilizer calculation, disease prevention, spray timing, or seed rates.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg pt-2 text-left">
                  {[
                    "Diagnose yellowing leaves on my wheat crop",
                    "Best chemical treatment for tomato early blight",
                    "How to calculate NPK dosage for 2 hectares of rice",
                    "When is the best weather window for pesticide spray"
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(p)}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs text-slate-700 text-left transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.sender === "user";
                return (
                  <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-0.5">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                        isUser
                          ? "bg-emerald-600 text-white shadow-sm font-medium"
                          : "bg-slate-50 border border-slate-200 text-slate-900 shadow-sm"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  </div>
                );
              })
            )}

            {isGenerating && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 flex-shrink-0">
                  <Bot className="h-4 w-4 animate-spin" />
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  Formulating agronomical response...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="pt-4 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask the AI Agronomist any farming question..."
              className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isGenerating || !inputMessage.trim()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>Send</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
