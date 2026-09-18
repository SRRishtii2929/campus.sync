import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getBuddyResponse, getRoleAwareQuestions, type BuddyResponse, type HistoryMessage } from '@/lib/campusBuddy';
import { X, Send, Sparkles, ArrowRight, LogIn } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'buddy';
  text: string;
  action?: { path: string; highlight: string; label: string };
  quickLinks?: { label: string; path: string; highlight: string }[];
  showLogin?: boolean;
}

const GREETING: ChatMessage = {
  role: 'buddy',
  text: `Hi! I'm Campus Buddy \u{1F63B} \u2014 your guide to CampusSync. Ask me anything or click a question below to get started!`,
};

const LOGGED_OUT_GREETING: ChatMessage = {
  role: 'buddy',
  text: `Hi! \u{1F44B} I'm Campus Buddy, the AI assistant for CampusSync.\n\nI can help you find and understand campus information such as notices, events, deadlines, announcements, timetable updates, and other important updates.\n\nTo ask questions about your college or get personalized information, please log in to CampusSync first.\n\n\u{1F510} Please log in to continue.`,
  showLogin: true,
};

const LOGGED_OUT_EXAMPLES = [
  'What important notices do I have?',
  'What events are happening this week?',
  'What deadlines are coming up?',
  'What did I miss?',
  'Are there any relevant opportunities?',
];

const LOGIN_REQUIRED_REPLY: ChatMessage = {
  role: 'buddy',
  text: `Please log in to CampusSync to access campus-specific information. \u{1F510}`,
  showLogin: true,
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
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const isLoggedIn = Boolean(session);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages(isLoggedIn ? [GREETING] : [LOGGED_OUT_GREETING]);
      setInput('');
      setThinking(false);
    }
  }, [open, isLoggedIn]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, thinking]);

  async function handleSend(query: string) {
    if (!query.trim()) return;

    if (!isLoggedIn) {
      const userMsg: ChatMessage = { role: 'user', text: query };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setThinking(true);
      setTimeout(() => {
        setThinking(false);
        setMessages((prev) => [...prev, LOGIN_REQUIRED_REPLY]);
      }, 600);
      return;
    }

    const userMsg: ChatMessage = { role: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    const history: HistoryMessage[] = messages.map((m) => ({ role: m.role, text: m.text }));
    const response: BuddyResponse = await getBuddyResponse(query, profile, history);
    setThinking(false);

    const buddyMsg: ChatMessage = {
      role: 'buddy',
      text: response.text,
      action: response.action,
      quickLinks: response.quickLinks,
    };
    setMessages((prev) => [...prev, buddyMsg]);
  }

  function handleCommonQuestion(label: string) {
    handleSend(label);
  }

  function handleAction(action: { path: string; highlight: string }) {
    navigateWithHighlight(navigate, action.path, action.highlight);
  }

  function handleClose() {
    setMessages(isLoggedIn ? [GREETING] : [LOGGED_OUT_GREETING]);
    setInput('');
    setThinking(false);
    setOpen(false);
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
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] h-[85vh] sm:h-[600px] sm:max-h-[80vh] bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
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
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50 dark:bg-slate-900">
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={msg.role === 'user'
                  ? 'max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-teal-600 text-white text-sm'
                  : 'max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm'
                }>
                  <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                  {msg.showLogin && (
                    <button
                      onClick={() => navigate('/login')}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" /> Login
                    </button>
                  )}

                  {msg.action && (
                    <button
                      onClick={() => handleAction(msg.action!)}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-semibold hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors border border-teal-200 dark:border-teal-800"
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
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors border border-teal-200 dark:border-teal-800"
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
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
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

          {/* Common questions / examples */}
          {isLoggedIn && messages.length <= 2 && (
            <div className="px-3 py-2 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
              <div className="flex flex-wrap gap-1.5">
                {getRoleAwareQuestions(profile).map((q) => (
                  <button
                    key={q.label}
                    onClick={() => handleCommonQuestion(q.label)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300 transition-colors border border-slate-200 dark:border-slate-600"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Logged-out example questions (display only) */}
          {!isLoggedIn && (
            <div className="px-3 py-2 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">What can I ask?</p>
              <div className="flex flex-wrap gap-1.5">
                {LOGGED_OUT_EXAMPLES.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleCommonQuestion(q)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300 transition-colors border border-slate-200 dark:border-slate-600"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="px-3 py-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
            {isLoggedIn ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Campus Buddy anything..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || thinking}
                  className="p-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-400 dark:text-slate-500">
                <LogIn className="w-4 h-4" />
                <span>Log in to ask questions</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
