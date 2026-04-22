import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const AUTH_URL = func2url.auth;
const CHAT_URL = func2url.chat;

interface User {
  id: number;
  username: string;
  avatar_color: string;
}

interface Message {
  id: number;
  content: string;
  created_at: string;
  username: string;
  avatar_color: string;
}

interface Channel {
  id: number;
  name: string;
}

// ─── Экран авторизации ────────────────────────────────────────────────
function AuthScreen({ onLogin }: { onLogin: (user: User, session: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, username, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Ошибка");
      } else {
        localStorage.setItem("session_id", data.session_id);
        onLogin(data.user, data.session_id);
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#36393f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Логотип */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#5865f2] rounded-full flex items-center justify-center">
              <Icon name="MessageCircle" size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Дискордик</h1>
              <p className="text-[#b9bbbe] text-sm">Закрытый чат</p>
            </div>
          </div>
        </div>

        {/* Форма */}
        <div className="bg-[#2f3136] rounded-lg p-8 shadow-2xl">
          <h2 className="text-white text-2xl font-bold text-center mb-2">
            {mode === "login" ? "С возвращением!" : "Создать аккаунт"}
          </h2>
          <p className="text-[#b9bbbe] text-center mb-6 text-sm">
            {mode === "login" ? "Рады снова тебя видеть!" : "Присоединяйся к нашему сообществу"}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-[#b9bbbe] text-xs font-semibold uppercase tracking-wide mb-1.5">
                Имя пользователя
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="введи имя..."
                className="bg-[#40444b] border-[#202225] text-white placeholder:text-[#72767d] focus:border-[#5865f2]"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-[#b9bbbe] text-xs font-semibold uppercase tracking-wide mb-1.5">
                Пароль
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="введи пароль..."
                className="bg-[#40444b] border-[#202225] text-white placeholder:text-[#72767d] focus:border-[#5865f2]"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-[#ed4245]/20 border border-[#ed4245]/40 rounded p-3 text-[#ed4245] text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={submit}
              disabled={loading || !username || !password}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium py-2.5"
            >
              {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
            </Button>
          </div>

          <p className="text-[#72767d] text-sm mt-4 text-center">
            {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-[#00b0f4] hover:underline"
            >
              {mode === "login" ? "Зарегистрироваться" : "Войти"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Основной чат ──────────────────────────────────────────────────────
function ChatScreen({ user, sessionId, onLogout }: { user: User; sessionId: string; onLogout: () => void }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState("общий");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<number | null>(null);

  const fetchMessages = async (channel = activeChannel) => {
    const res = await fetch(`${CHAT_URL}?channel=${encodeURIComponent(channel)}`, {
      headers: { "X-Session-Id": sessionId },
    });
    const data = await res.json();
    setChannels(data.channels || []);
    setMessages(data.messages || []);
  };

  useEffect(() => {
    fetchMessages(activeChannel);
    pollingRef.current = window.setInterval(() => fetchMessages(activeChannel), 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    try {
      await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
        body: JSON.stringify({ content, channel: activeChannel }),
      });
      await fetchMessages(activeChannel);
    } finally {
      setSending(false);
    }
  };

  const avatarLetter = (name: string) => name[0]?.toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-[#36393f] text-white flex flex-col overflow-hidden">
      {/* Навбар */}
      <nav className="bg-[#2f3136] border-b border-[#202225] px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#5865f2] rounded-full flex items-center justify-center">
            <Icon name="MessageCircle" size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">Дискордик</h1>
            <p className="text-xs text-[#b9bbbe]">Закрытый чат</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-[#202225] rounded-full px-3 py-1.5">
            <div className={`w-6 h-6 bg-gradient-to-r ${user.avatar_color} rounded-full flex items-center justify-center`}>
              <span className="text-white text-xs font-bold">{avatarLetter(user.username)}</span>
            </div>
            <span className="text-white text-sm font-medium">{user.username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-[#b9bbbe] hover:text-white hover:bg-[#40444b] p-2"
          >
            <Icon name="LogOut" size={16} />
          </Button>
        </div>
      </nav>

      {/* Основной макет */}
      <div className="flex flex-1 overflow-hidden">
        {/* Боковая панель серверов */}
        <div className="hidden lg:flex w-[72px] bg-[#202225] flex-col items-center py-3 gap-2 flex-shrink-0">
          <div className="w-12 h-12 bg-[#5865f2] rounded-2xl flex items-center justify-center cursor-pointer">
            <Icon name="MessageCircle" size={22} className="text-white" />
          </div>
          <div className="w-8 h-0.5 bg-[#36393f] rounded-full"></div>
        </div>

        {/* Боковая панель каналов */}
        <div className={`${mobileSidebarOpen ? "absolute inset-y-0 left-0 z-20" : "hidden"} lg:relative lg:flex w-60 bg-[#2f3136] flex-col flex-shrink-0`}>
          <div className="p-4 border-b border-[#202225] flex items-center justify-between">
            <h2 className="text-white font-semibold">Каналы</h2>
            <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden text-[#b9bbbe] hover:text-white">
              <Icon name="X" size={16} />
            </button>
          </div>
          <div className="flex-1 p-2 overflow-y-auto">
            <div className="mb-2 px-2 py-1 text-[#8e9297] text-xs font-semibold uppercase tracking-wide">
              Текстовые каналы
            </div>
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => { setActiveChannel(ch.name); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  activeChannel === ch.name
                    ? "bg-[#393c43] text-white"
                    : "text-[#8e9297] hover:text-[#dcddde] hover:bg-[#393c43]/50"
                }`}
              >
                <Icon name="Hash" size={16} />
                {ch.name}
              </button>
            ))}
          </div>
          {/* Пользователь */}
          <div className="p-2 bg-[#292b2f] flex items-center gap-2">
            <div className={`w-8 h-8 bg-gradient-to-r ${user.avatar_color} rounded-full flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-sm font-bold">{avatarLetter(user.username)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{user.username}</div>
              <div className="text-[#3ba55c] text-xs">● В сети</div>
            </div>
          </div>
        </div>

        {/* Область сообщений */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Заголовок канала */}
          <div className="h-12 bg-[#36393f] border-b border-[#202225] flex items-center px-4 gap-2 flex-shrink-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden text-[#8e9297] hover:text-white mr-2"
            >
              <Icon name="Menu" size={20} />
            </button>
            <Icon name="Hash" size={20} className="text-[#8e9297]" />
            <span className="text-white font-semibold">{activeChannel}</span>
          </div>

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#72767d]">
                <div className="w-16 h-16 bg-[#40444b] rounded-full flex items-center justify-center mb-4">
                  <Icon name="Hash" size={32} className="text-[#8e9297]" />
                </div>
                <p className="text-white font-semibold text-lg mb-1">Добро пожаловать в #{activeChannel}!</p>
                <p className="text-sm">Здесь пока нет сообщений. Напиши первым!</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3 group hover:bg-[#32353b] rounded px-2 py-1 -mx-2 transition-colors">
                <div className={`w-10 h-10 bg-gradient-to-r ${msg.avatar_color} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <span className="text-white text-sm font-bold">{avatarLetter(msg.username)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-white font-semibold text-sm">{msg.username}</span>
                    <span className="text-[#72767d] text-xs">{msg.created_at}</span>
                  </div>
                  <p className="text-[#dcddde] text-sm leading-relaxed break-words">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Поле ввода */}
          <div className="p-4 flex-shrink-0">
            <div className="bg-[#40444b] rounded-lg flex items-center gap-2 px-4 py-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder={`Сообщение #${activeChannel}`}
                className="flex-1 bg-transparent text-[#dcddde] placeholder:text-[#72767d] outline-none text-sm"
                disabled={sending}
                maxLength={2000}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="text-[#b9bbbe] hover:text-white disabled:opacity-40 transition-colors"
              >
                <Icon name="Send" size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Главный компонент ─────────────────────────────────────────────────
const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("session_id");
    if (stored) {
      fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": stored },
        body: JSON.stringify({ action: "me" }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            setUser(data.user);
            setSessionId(stored);
          } else {
            localStorage.removeItem("session_id");
          }
        })
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const handleLogin = (u: User, sid: string) => {
    setUser(u);
    setSessionId(sid);
  };

  const handleLogout = async () => {
    if (sessionId) {
      await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
        body: JSON.stringify({ action: "logout" }),
      });
    }
    localStorage.removeItem("session_id");
    setUser(null);
    setSessionId(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#36393f] flex items-center justify-center">
        <div className="text-[#b9bbbe] text-sm flex items-center gap-2">
          <Icon name="Loader2" size={20} className="animate-spin" />
          Загрузка...
        </div>
      </div>
    );
  }

  if (!user || !sessionId) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return <ChatScreen user={user} sessionId={sessionId} onLogout={handleLogout} />;
};

export default Index;
