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
  ThumbsDown
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

  const handleFeedback = async (messageId: number, isPositive: boolean) => {
    try {
      await api.post(`/api/v1/advisor/feedback/${messageId}`, {
        thumbs_up: isPositive,
        thumbs_down: !isPositive
      });
      showToast("Thank you for your feedback!", "success");
    } catch (err) {
      console.error("Failed to log message feedback:", err);
      showToast("Could not submit feedback.", "error");
    }
  };

  // Suggested prompt pills
  const promptPills = [
    { text: "Correct acid soil pH", query: "How do I correct acid soil pH?" },
    { text: "Best tomato fertilizers", query: "What fertilizer is best for tomatoes?" },
    { text: "Control late blight", query: "How can I control late blight?" },
    { text: "Crops for clay soil", query: "Suggest crops suitable for heavy clay soil." }
  ];

  // Load chat threads list
  const loadSessions = async () => {
    try {
      const res = await api.get("/api/v1/advisor/sessions");
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // Fetch history for selected session
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    
    const loadSessionMessages = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await api.get(`/api/v1/advisor/sessions/${activeSessionId}`);
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to load message history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadSessionMessages();
  }, [activeSessionId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Handle message send
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    
    const userText = textToSend;
    setInputMessage("");
    setIsGenerating(true);

    // Optimistically push user message to local feed
    const tempUserMsg: Message = {
      id: Date.now(),
      session_id: activeSessionId || "",
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

      // Update active session ID and reload threads
      const aiResponse = res.data;
      if (!activeSessionId) {
        setActiveSessionId(aiResponse.session_id);
        loadSessions();
      }

      setMessages((prev) => {
        // Replace temp items with database resolved payload
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        return [...filtered, tempUserMsg, aiResponse];
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      // Push error indicator message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          session_id: activeSessionId || "",
          sender: "assistant",
          content: "❌ Error: Failed to generate advisor response. Please verify server connection."
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete chat thread
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

  // Start new conversation
  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  // Format advisor markdown segments for visual clarity (custom simple parser)
  const renderMessageContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, index) => {
      // Bold items
      let cleanLine = line;
      
      // Blockquotes
      if (line.startsWith("> ")) {
        return (
          <blockquote key={index} className="border-l-4 border-primary pl-3 my-2 text-neutral-400 italic text-sm">
            {line.substring(2)}
          </blockquote>
        );
      }
      
      // Headers
      if (line.startsWith("### ")) {
        return <h4 key={index} className="text-base font-bold text-white mt-4 mb-2">{line.substring(4)}</h4>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={index} className="text-lg font-bold text-white mt-4 mb-2">{line.substring(3)}</h3>;
      }
      if (line.startsWith("# ")) {
        return <h2 key={index} className="text-xl font-bold text-white mt-4 mb-2">{line.substring(2)}</h2>;
      }

      // Bullet points
      if (line.startsWith("* ") || line.startsWith("- ")) {
        return (
          <li key={index} className="ml-4 list-disc text-sm text-neutral-300 mb-1 leading-relaxed">
            {parseInlineStyles(line.substring(2))}
          </li>
        );
      }

      // Ordered list
      const olMatch = line.match(/^(\d+)\.\s(.*)/);
      if (olMatch) {
        return (
          <li key={index} className="ml-4 list-decimal text-sm text-neutral-300 mb-1 leading-relaxed">
            {parseInlineStyles(olMatch[2])}
          </li>
        );
      }

      // Standard paragraphs
      return (
        <p key={index} className="text-sm leading-relaxed text-neutral-300 mb-2">
          {parseInlineStyles(cleanLine)}
        </p>
      );
    });
  };

  const parseInlineStyles = (text: string) => {
    // Basic bold **text** parsing
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-primary font-bold">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="glass sticky top-0 z-40 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-800 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Crop Advisor
            </h1>
          </div>

          <button 
            onClick={startNewChat}
            className="md:hidden bg-primary/10 border border-primary/20 text-primary p-2 rounded-xl text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full flex items-stretch overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Sidebar chats threads */}
        <aside className="hidden md:flex w-72 border-r border-neutral-850 flex-col bg-neutral-950/40 p-4 justify-between">
          <div className="space-y-4">
            <button
              onClick={startNewChat}
              className="w-full bg-primary/10 border border-primary/20 hover:border-primary/40 text-primary font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,200,117,0.05)]"
            >
              <Plus className="h-4 w-4" />
              Start New Thread
            </button>

            <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-14rem)]">
              <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-3 mb-2">Saved Threads</div>
              
              {sessions.length === 0 ? (
                <div className="text-xs text-neutral-600 px-3 py-4 italic flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-neutral-700" />
                  No threads saved yet.
                </div>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.session_id}
                    onClick={() => setActiveSessionId(s.session_id)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all border text-left group ${
                      activeSessionId === s.session_id
                        ? "bg-neutral-800/80 border-primary/20 text-white"
                        : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate max-w-[80%]">
                      <MessageSquare className={`h-4 w-4 flex-shrink-0 ${activeSessionId === s.session_id ? "text-primary" : "text-neutral-500"}`} />
                      <span className="text-xs font-semibold truncate">{s.session_title}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteSession(e, s.session_id)}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-neutral-900 pt-4 text-[10px] text-neutral-600 flex items-center gap-1.5 justify-center">
            <Activity className="h-3 w-3 text-neutral-500" />
            Database Synced | Session Engine Active
          </div>
        </aside>

        {/* Chat window */}
        <main className="flex-1 flex flex-col justify-between bg-neutral-950/20 relative">
          
          {/* Scrollable messages panel */}
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 max-h-[calc(100vh-11rem)]">
            
            {messages.length === 0 && !isLoadingHistory ? (
              /* Welcome screen if empty chat */
              <div className="max-w-2xl mx-auto text-center py-12 flex flex-col items-center justify-center min-h-[350px]">
                <div className="bg-primary/10 border border-primary/20 p-4 rounded-3xl mb-6 text-primary animate-bounce">
                  <Bot className="h-10 w-10" />
                </div>
                <h3 className="font-display text-2xl font-bold text-white mb-2">AgriNexus AI Assistant</h3>
                <p className="text-neutral-400 text-sm max-w-md leading-relaxed mb-8">
                  Get insights on crop selection, NPK balances, water scheduling, and soil correction guidelines.
                </p>

                {/* Predefined prompt buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  {promptPills.map((pill, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(pill.query)}
                      className="glass glass-hover p-4 rounded-xl border border-neutral-800 text-left text-xs font-semibold text-neutral-300 transition-all flex items-center justify-between group"
                    >
                      <span>{pill.text}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-neutral-500 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            ) : isLoadingHistory ? (
              /* Loading Indicator */
              <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                <span className="text-xs font-semibold">Retrieving thread logs...</span>
              </div>
            ) : (
              /* Conversation Messages list */
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div 
                      key={msg.id}
                      className={`flex gap-4 items-start ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {/* Avatar */}
                      {!isUser && (
                        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}
                      
                      {/* Message Bubble */}
                      <div className={`p-4 rounded-2xl max-w-[85%] border shadow-sm relative ${
                        isUser 
                          ? "bg-primary border-primary text-neutral-950 font-medium rounded-tr-none" 
                          : "glass border-neutral-800 text-neutral-100 rounded-tl-none"
                      }`}>
                        {isUser ? (
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        ) : (
                          <div>
                            {renderMessageContent(msg.content)}
                            <div className="flex gap-2 items-center mt-3 pt-2 border-t border-neutral-800/40 text-[10px] text-neutral-400">
                              <span>Was this helpful?</span>
                              <button 
                                onClick={() => handleFeedback(msg.id, true)} 
                                className="p-1 rounded hover:bg-neutral-800 hover:text-primary transition-colors"
                                title="Helpful"
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </button>
                              <button 
                                onClick={() => handleFeedback(msg.id, false)} 
                                className="p-1 rounded hover:bg-neutral-800 hover:text-red-400 transition-colors"
                                title="Not helpful"
                              >
                                <ThumbsDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <div className="h-8 w-8 rounded-lg bg-neutral-850 border border-neutral-800 flex items-center justify-center text-neutral-300 flex-shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {isGenerating && (
                  /* Typings / Thinking Indicator */
                  <div className="flex gap-4 items-start justify-start">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0 animate-pulse">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="glass border border-neutral-800 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                      <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom input area */}
          <div className="glass border-t border-neutral-850 p-4">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputMessage);
              }}
              className="max-w-3xl mx-auto flex items-center gap-3 relative"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask AgriNexus AI (e.g. soil correction, NPK, irrigation...)"
                className="w-full bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-neutral-500 outline-none transition-all duration-300"
                disabled={isGenerating || isLoadingHistory}
              />
              
              <button
                type="submit"
                className="absolute right-2.5 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-primary-600 text-neutral-950 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(0,200,117,0.15)]"
                disabled={isGenerating || isLoadingHistory || !inputMessage.trim()}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

        </main>
      </div>
    </div>
  );
}
