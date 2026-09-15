import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase, type ChatbotHistoryEntry } from '@/lib/supabase';
import { getBuddyResponse, COMMON_QUESTIONS, type BuddyResponse } from '@/lib/campusBuddy';
import { X, Send, Sparkles, ArrowRight, Trash2 } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'buddy';
  text: string;
  action?: { path: string; highlight: string; label: string };
  quickLinks?: { label: string; path: string; highlight: string }[];
}

const GREETING: ChatMessage = {
  role: 'buddy',
  text: `Hi! I'm Campus Buddy \u{1F63B} \u2014 your guide to CampusSync. Ask me anything or click a question below to get started!`,
};

function navigateWithHighlight(navigate: ReturnType<typeof useNavigate>, path: string, highlight: string) {
  navigate(`${path}?highlight=${highlight}`);
  setTimeout(() => {
    const el = document.getElementById(highlight);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('buddy-highlight');
      setTimeout(() => el.classList.remove('buddy-highlight'), 4000);
    }
  }, 600);
}

export default function CampusBuddy() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    if (!session?.user?.id) { setHistoryLoaded(true); return; }
    const { data } = await supabase
      .from('chatbot_history')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);
    if (data && data.length > 0) {
      const restored: ChatMessage[] = (data as ChatbotHistoryEntry[]).map((row) => {
        const msg: ChatMessage = { role: row.role, text: row.text };
        if (row.action_path && row.action_highlight && row.action_label) {
          msg.action = { path: row.action_path, highlight: row.action_highlight, label: row.action_label };
        }
        return msg;
      });
      setMessages([...restored, GREETING]);
    }
    setHistoryLoaded(true);
  }, [session?.user?.id]);

  useEffect(() => {
    if (open && !historyLoaded) {
      loadHistory();
    }
  }, [open, historyLoaded, loadHistory]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, thinking]);

  async function saveMessage(msg: ChatMessage) {
    if (!session?.user?.id) return;
    await supabase.from('chatbot_history').insert({
      user_id: session.user.id,
      role: msg.role,
      text: msg.text,
      action_path: msg.action?.path || null,
      action_highlight: msg.action?.highlight || null,
      action_label: msg.action?.label || null,
    });
  }

  async function handleSend(query: string) {
    if (!query.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setThinking(true);
    saveMessage(userMsg);

    const response: BuddyResponse = await getBuddyResponse(query, profile);
    setThinking(false);

    const buddyMsg: ChatMessage = {
      role: 'buddy',
      text: response.text,
      action: response.action,
      quickLinks: response.quickLinks,
    };
    setMessages((prev) => [...prev, buddyMsg]);
    saveMessage(buddyMsg);
  }

  function handleCommonQuestion(label: string) {
    handleSend(label);
  }

  function handleAction(action: { path: string; highlight: string }) {
    navigateWithHighlight(navigate, action.path, action.highlight);
  }

  async function handleClearHistory() {
    if (!session?.user?.id) return;
    await supabase.from('chatbot_history').delete().eq('user_id', session.user.id);
    setMessages([GREETING]);
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          aria-label="Ask Campus Buddy"
        >
          <Sparkles className="w-5 h-5" />
          <span className="hidden sm:inline">Ask Campus Buddy</span>
          <span className="sm:hidden">Buddy</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] h-[85vh] sm:h-[600px] sm:max-h-[80vh] bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Campus Buddy 😻</p>
                <p className="text-xs text-teal-100">Your CampusSync guide</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button onClick={handleClearHistory} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" title="Clear chat history">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={msg.role === 'user'
                  ? 'max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-teal-600 text-white text-sm'
                  : 'max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white border border-slate-200 text-slate-700 text-sm'
                }>
                  <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                  {msg.action && (
                    <button
                      onClick={() => handleAction(msg.action!)}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-xs font-semibold hover:bg-teal-100 transition-colors border border-teal-200"
                    >
                      {msg.action.label} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {msg.quickLinks && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {msg.quickLinks.map((link) => (
                        <button
                          key={link.label}
                          onClick={() => handleAction(link)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-xs font-medium hover:bg-teal-100 transition-colors border border-teal-200"
                        >
                          {link.label} <ArrowRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white border border-slate-200">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Common questions */}
          {messages.length <= 2 && (
            <div className="px-3 py-2 bg-white border-t border-slate-100">
              <div className="flex flex-wrap gap-1.5">
                {COMMON_QUESTIONS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => handleCommonQuestion(q.label)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors border border-slate-200"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="px-3 py-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Campus Buddy anything..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || thinking}
                className="p-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
