import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Terminal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Database,
  Activity,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm your **AI Data Analyst**. \n\nI can access the company database to answer questions about employees, salaries, and departments. How can I help you?",
      sql: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => scrollToBottom(), [messages, currentStep]);

  const getStepText = (step) => {
    switch (step) {
      case "queued":
        return "Queuing request...";
      case "classify_input":
        return "Understanding your intent...";
      case "general_chat":
        return "Thinking...";
      case "get_schema":
        return "Reading Database Schema...";
      case "generate_sql":
        return "Writing SQL Query logic...";
      case "execute_sql":
        return "Executing Query on PostgreSQL...";
      case "summarize":
        return "Analyzing results...";
      default:
        return "Processing...";
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setCurrentStep("queued");

    try {
      const historyStrings = messages
        .slice(-6)
        .map(
          (msg) =>
            `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
        );

      const startResponse = await fetch("http://localhost:8000/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          session_id: "web-user-session",
          history: historyStrings,
        }),
      });

      const { job_id } = await startResponse.json();

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://localhost:8000/job/${job_id}`);
          const statusData = await statusRes.json();

          if (statusData.step) setCurrentStep(statusData.step);

          if (
            statusData.status === "completed" ||
            statusData.status === "failed"
          ) {
            clearInterval(pollInterval);
            setIsLoading(false);

            if (statusData.status === "completed") {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: statusData.data.response,
                  sql: statusData.data.sql_used,
                },
              ]);
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "⚠️ **Error**: " +
                    (statusData.error || "Unknown system failure."),
                },
              ]);
            }
          }
        } catch (err) {
          clearInterval(pollInterval);
          setIsLoading(false);
        }
      }, 500);
    } catch (error) {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ **Connection Error**: Backend unavailable.",
        },
      ]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0B1120] text-slate-100 font-sans selection:bg-blue-500/30">
      <div className="fixed top-0 w-full z-10 bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <Database size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                SQL Agent{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  Pro
                </span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-24 pb-36 px-4 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              role={msg.role}
              content={msg.content}
              sql={msg.sql}
            />
          ))}

          {isLoading && (
            <div className="flex justify-start animate-fade-in pl-1">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 px-5 py-4 rounded-2xl rounded-tl-none shadow-lg">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 blur-md opacity-20 animate-pulse"></div>
                    <Activity
                      size={20}
                      className="text-blue-400 animate-spin-slow"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-blue-100 transition-all duration-300 min-w-[180px]">
                      {getStepText(currentStep)}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Step: {currentStep}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-0 w-full bg-gradient-to-t from-[#0B1120] via-[#0B1120]/95 to-transparent pt-12 pb-8 z-20">
        <div className="max-w-3xl mx-auto px-4">
          <form onSubmit={sendMessage} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 rounded-full opacity-20 group-hover:opacity-40 transition duration-500 blur-lg"></div>
            <div className="relative flex items-center gap-2 bg-[#1e293b]/80 backdrop-blur-2xl border border-white/10 rounded-full p-2 pl-6 shadow-2xl transition-all">
              <input
                type="text"
                className="flex-1 bg-transparent border-none py-3 focus:outline-none text-slate-100 placeholder-slate-500 text-sm md:text-base font-medium"
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} className="ml-0.5" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// SQL highlighter component: lightweight, safe formatting for display only
const SqlHighlighter = ({ code }) => {
  if (!code) return null;

  // Split by spaces, newlines, and punctuation to identify keywords safely
  const parts = code.split(/(\s+|[(),;'])/);

  const keywords = [
    "SELECT",
    "FROM",
    "WHERE",
    "AND",
    "OR",
    "ORDER",
    "BY",
    "LIMIT",
    "GROUP",
    "COUNT",
    "SUM",
    "AVG",
    "AS",
    "ON",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "DESC",
    "ASC",
    "INSERT",
    "UPDATE",
    "DELETE",
    "VALUES",
  ];

  return (
    <code className="text-blue-100 whitespace-pre-wrap font-mono text-xs">
      {parts.map((part, index) => {
        const upper = part.toUpperCase();
        if (keywords.includes(upper)) {
          return (
            <span key={index} className="text-purple-400 font-bold">
              {part}
            </span>
          );
        } else if (part.match(/^\d+$/)) {
          return (
            <span key={index} className="text-orange-300">
              {part}
            </span>
          );
        } else if (part.startsWith("'")) {
          return (
            <span key={index} className="text-yellow-300">
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </code>
  );
};

const MessageBubble = ({ role, content, sql }) => {
  const isUser = role === "user";
  const [showSql, setShowSql] = useState(false);

  return (
    <div
      className={`flex w-full ${
        isUser ? "justify-end" : "justify-start"
      } animate-in slide-in-from-bottom-2 duration-300`}
    >
      <div
        className={`flex max-w-[85%] md:max-w-[75%] gap-4 ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-offset-2 ring-offset-[#0B1120] ${
            isUser
              ? "bg-indigo-500 ring-indigo-500/30"
              : "bg-blue-600 ring-blue-600/30"
          }`}
        >
          {isUser ? (
            <User size={16} className="text-white" />
          ) : (
            <Bot size={16} className="text-white" />
          )}
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <span
            className={`text-[11px] font-bold uppercase tracking-wider ${
              isUser ? "text-right text-indigo-400" : "text-left text-blue-400"
            }`}
          >
            {isUser ? "You" : "Data Agent"}
          </span>
          <div
            className={`px-5 py-4 rounded-2xl shadow-sm leading-relaxed text-sm md:text-base ${
              isUser
                ? "bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-tr-sm"
                : "bg-white/5 backdrop-blur-md border border-white/10 text-slate-200 rounded-tl-sm shadow-xl"
            }`}
          >
            <ReactMarkdown
              components={{
                code: ({ children }) => (
                  <code className="bg-black/30 px-1 py-0.5 rounded text-yellow-300 font-mono text-xs">
                    {children}
                  </code>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
          {sql && sql !== "SKIP" && (
            <div className="mt-1">
              <button
                onClick={() => setShowSql(!showSql)}
                className={`flex items-center gap-2 text-xs font-medium transition-all px-3 py-2 rounded-lg border ${
                  showSql
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : "text-slate-500 hover:text-slate-300 bg-white/5 border-transparent hover:border-white/10"
                }`}
              >
                <Terminal size={12} />{" "}
                {showSql ? "Hide Database Query" : "View Database Query"}{" "}
                {showSql ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showSql && (
                <div className="mt-3 bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                      PostgreSQL / Read-Only
                    </span>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <div className="flex gap-3 text-xs font-mono leading-relaxed">
                      {/* Line Numbers */}
                      <div className="flex flex-col text-slate-700 select-none text-right min-w-[20px] border-r border-slate-800 pr-2 mr-2">
                        <span>1</span>
                      </div>
                      <SqlHighlighter code={sql} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
