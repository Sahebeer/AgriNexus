"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
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
  ArrowRight,
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

export default function AdvisorChatPage() {
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

  // Fetch contextual weather and market prices on login session load
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
    if (user) {
      fetchContextData();
    }
  }, [user]);

  // Load chat session list
  const loadSessions = async () => {
    try {
      const res = await api.get("/api/v1/advisor/sessions");
      setSessions(res.data || []);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await api.get(`/api/v1/advisor/sessions/${activeSessionId}`);
        setMessages(res.data.messages || []);
      } catch (err) {
        console.error("Failed to fetch messages for session:", err);
        showToast("Error retrieving chat history.", "error");
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [activeSessionId]);

  // Scroll to bottom on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Predefined prompts tailored for agricultural cycles
  const promptPills = [
    { text: "Optimal wheat top-dressing schedule", query: "What is the optimal urea and zinc top-dressing timing for wheat during the tillering stage?" },
    { text: "Drip irrigation water budget for tomatoes", query: "Calculate the weekly drip irrigation requirement per hectare for tomatoes in 32°C weather." },
    { text: "Organic management for fall armyworm", query: "What organic IPM methods and bio-pesticides work best for maize fall armyworm control?" },
    { text: "Correcting acidic soil pH (5.8 to 6.5)", query: "How much agricultural lime or dolomite is needed to raise soil pH from 5.8 to 6.5 in sandy loam?" },
  ];

  // Send feedback on message
  const handleFeedback = async (msgId: number, isPositive: boolean) => {
    try {
      await api.post(`/api/v1/advisor/messages/${msgId}/feedback`, {
        is_positive: isPositive
      });
      showToast("Thank you for your agronomic feedback!", "success");
    } catch (err) {
      console.error("Feedback error:", err);
    }
  };

  // Dispatch message
  const handleSendMessage = async (textToSend?: string) => {
    const userText = textToSend || inputMessage;
    if (!userText.trim() || isGenerating) return;

    setInputMessage("");
    setIsGenerating(true);

    // Optimistically append user message
    const tempUserMsg: Message = {
      id: Date.now(),
      session_id: activeSessionId || "temp",
      sender: "user",
      content: userText
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // Fetch user farms from localStorage
    let farms = [];
    if (user?.email) {
      try {
        const stored = localStorage.getItem(`agrinexus_farms_${user.email}`);
        if (stored) farms = JSON.parse(stored);
      } catch (e) {
        console.error("Local storage farm parsing error inside chat:", e);
      }
    }

    try {
      const res = await api.post("/api/v1/advisor/chat", {
        content: userText,
        session_id: activeSessionId || undefined,
        farmer_context: {
          farms: farms,
          weather: weatherData,
          prices: marketPrices
        }
      });

      const aiResponse = res.data;
      if (!activeSessionId) {
        setActiveSessionId(aiResponse.session_id);
        loadSessions();
      }

      setMessages((prev) => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        return [...filtered, tempUserMsg, aiResponse];
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          session_id: activeSessionId || "",
          sender: "assistant",
          content: "Unable to generate advisor response. Please check your backend connection."
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/v1/advisor/sessions/${sid}`);
      if (activeSessionId === sid) {
        setActiveSessionId(null);
        setMessages([]);
      }
      setSessions((prev) => prev.filter(s => s.session_id !== sid));
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, index) => {
      if (line.startsWith("> ")) {
        return (
          <blockquote key={index} className="border-l-2 border-emerald-500 pl-3 my-2 text-slate-600 italic text-xs leading-relaxed">
            {line.substring(2)}
          </blockquote>
        );
      }
      if (line.startsWith("### ")) {
        return <h4 key={index} className="text-sm font-bold text-slate-900 mt-3 mb-1.5">{line.substring(4)}</h4>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={index} className="text-base font-bold text-emerald-800 mt-4 mb-2">{line.substring(3)}</h3>;
      }
      if (line.startsWith("# ")) {
        return <h2 key={index} className="text-lg font-extrabold text-slate-900 mt-4 mb-2">{line.substring(2)}</h2>;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <div key={index} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700 my-1">
            <span className="text-emerald-600 font-bold mt-0.5">•</span>
            <span>{parseInlineStyles(line.substring(2))}</span>
          </div>
        );
      }
      if (line.trim() === "") {
        return <div key={index} className="h-1.5" />;
      }
      return (
        <p key={index} className="text-xs leading-relaxed text-slate-700 mb-1.5">
          {parseInlineStyles(line)}
        </p>
      );
    });
  };

  const parseInlineStyles = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-slate-900 font-bold">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bot className="h-5 w-5 text-emerald-600" />
                Agronomy Advisor
              </h1>
              <p className="text-xs text-slate-500">
                Precision soil, weather, and crop management recommendations
              </p>
            </div>
          </div>

          <button 
            onClick={startNewChat}
            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Consultation</span>
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 max-w-7xl mx-auto w-full flex items-stretch overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Left Sidebar: Threads & Live Context */}
        <aside className="hidden md:flex w-72 border-r border-slate-200 flex-col bg-white p-4 justify-between select-none">
          <div className="space-y-4">
            <button
              onClick={startNewChat}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Consultation
            </button>

            {/* Saved Threads */}
            <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-20rem)]">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                Past Consultations
              </div>
              
              {sessions.length === 0 ? (
                <div className="text-xs text-slate-400 px-2 py-3 italic flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-slate-300" />
                  No previous sessions.
                </div>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.session_id}
                    onClick={() => setActiveSessionId(s.session_id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all border text-left group ${
                      activeSessionId === s.session_id
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold shadow-sm"
                        : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate max-w-[80%]">
                      <MessageSquare className={`h-3.5 w-3.5 flex-shrink-0 ${activeSessionId === s.session_id ? "text-emerald-600" : "text-slate-400"}`} />
                      <span className="text-xs truncate">{s.session_title}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteSession(e, s.session_id)}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-600 p-1 rounded transition-all text-slate-400"
                      title="Delete thread"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Live Farm Context Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-left text-[11px]">
            <div className="flex items-center justify-between text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <span>Active Field Context</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="space-y-1 text-slate-700">
              <div className="flex items-center gap-1.5">
                <CloudSun className="h-3.5 w-3.5 text-sky-600" />
                <span className="truncate">{weatherData ? `${weatherData.temp || 28}°C • ${weatherData.condition || 'Fair'}` : 'Weather Synced'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sprout className="h-3.5 w-3.5 text-emerald-600" />
                <span>Soil Telemetry & Cropping History</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col justify-between bg-slate-50/60 relative">
          {/* Scrollable messages panel */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5 max-h-[calc(100vh-10rem)]">
            {messages.length === 0 && !isLoadingHistory ? (
              /* Welcome screen if empty chat */
              <div className="max-w-2xl mx-auto text-center py-8 flex flex-col items-center justify-center min-h-[350px]">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 mb-4 shadow-sm">
                  <Bot className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1.5 tracking-tight">
                  AgriNexus Agronomy Advisor
                </h3>
                <p className="text-slate-500 text-xs max-w-md leading-relaxed mb-6">
                  Get personalized recommendations on fertilizer requirements, irrigation scheduling, weed management, and crop health.
                </p>

                {/* Predefined prompt pills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                  {promptPills.map((pill, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(pill.query)}
                      className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-left text-xs font-semibold text-slate-800 transition-all flex items-center justify-between group shadow-sm"
                    >
                      <span className="leading-snug">{pill.text}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <RefreshCw className="h-5 w-5 text-emerald-600 animate-spin" />
                <span className="text-xs font-semibold">Loading consultation history...</span>
              </div>
            ) : (
              /* Messages list */
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div 
                      key={msg.id}
                      className={`flex gap-3 items-start ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="h-7 w-7 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-1 shadow-sm">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}
                      
                      <div className={`p-4 rounded-2xl max-w-[85%] text-left shadow-sm ${
                        isUser 
                          ? "bg-emerald-600 text-white rounded-tr-none" 
                          : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                      }`}>
                        {isUser ? (
                          <p className="text-xs font-medium leading-relaxed">{msg.content}</p>
                        ) : (
                          <div>
                            {renderMessageContent(msg.content)}
                            <div className="flex gap-2 items-center mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400">
                              <span>Was this guidance helpful?</span>
                              <button 
                                onClick={() => handleFeedback(msg.id, true)} 
                                className="p-1 rounded hover:bg-slate-100 hover:text-emerald-700 transition-colors"
                                title="Helpful"
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </button>
                              <button 
                                onClick={() => handleFeedback(msg.id, false)} 
                                className="p-1 rounded hover:bg-slate-100 hover:text-rose-600 transition-colors"
                                title="Needs Improvement"
                              >
                                <ThumbsDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isGenerating && (
                  <div className="flex gap-3 items-start justify-start animate-in fade-in">
                    <div className="h-7 w-7 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-1 shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs flex items-center gap-2 shadow-sm">
                      <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin" />
                      <span>Reviewing agronomic guidelines and live field context...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom Chat Input Bar */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="max-w-3xl mx-auto relative flex items-center">
              <input
                type="text"
                placeholder="Ask about fertilizer doses, soil correction, water requirements..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isGenerating}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 shadow-sm font-medium"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isGenerating}
                className="absolute right-2 p-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all disabled:opacity-40 shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              AgriNexus provides agricultural recommendations. Consult local extension services for high-risk chemical treatments.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
