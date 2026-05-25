import React, { useState, useRef, useEffect } from 'react';
import { CircularProgress } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Sparkles, ArrowUp } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { chatApi } from '../services/api';
import 'highlight.js/styles/github.css';

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "Show me this week's billable hours rollup",
  "Which clients haven't had a visit in 3+ weeks?",
  'Where can I fit a 4-hour install next week?',
  'Sarah called in sick — help me reschedule today',
];

const initialsFor = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const MarkdownMessage: React.FC<{ content: string }> = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
    components={{
      h1: ({ children }) => (
        <h2 style={{ fontWeight: 600, margin: '12px 0 8px', fontSize: 18 }}>{children}</h2>
      ),
      h2: ({ children }) => (
        <h3 style={{ fontWeight: 600, margin: '10px 0 6px', fontSize: 16 }}>{children}</h3>
      ),
      h3: ({ children }) => (
        <h4 style={{ fontWeight: 600, margin: '10px 0 6px', fontSize: 15 }}>{children}</h4>
      ),
      p: ({ children }) => (
        <p style={{ margin: '0 0 10px', fontSize: 15, lineHeight: 1.6 }}>{children}</p>
      ),
      ul: ({ children }) => (
        <ul style={{ paddingLeft: 22, margin: '0 0 10px' }}>{children}</ul>
      ),
      ol: ({ children }) => (
        <ol style={{ paddingLeft: 22, margin: '0 0 10px' }}>{children}</ol>
      ),
      li: ({ children }) => (
        <li style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 4 }}>{children}</li>
      ),
      code: ({ children, className }) => {
        const isInline = !className;
        return isInline ? (
          <code
            style={{
              backgroundColor: 'rgba(58,46,31,0.06)',
              padding: '1px 5px',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
            }}
          >
            {children}
          </code>
        ) : (
          <pre
            style={{
              background: 'var(--parchment)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 14,
              overflow: 'auto',
              margin: '0 0 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
            }}
          >
            <code className={className}>{children}</code>
          </pre>
        );
      },
      blockquote: ({ children }) => (
        <blockquote
          style={{
            borderLeft: '3px solid var(--border-strong)',
            background: 'var(--parchment)',
            margin: '0 0 10px',
            padding: '8px 14px',
            borderRadius: '0 8px 8px 0',
          }}
        >
          {children}
        </blockquote>
      ),
    }}
  >
    {content}
  </ReactMarkdown>
);

const Chat: React.FC = () => {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'there';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `Hi ${firstName} — I can help you analyze work activities, plan schedules, and surface insights from your business data.

**I'm good at:**
- Rolling up hours by client, helper, or week
- Spotting maintenance visits coming due
- Finding open slots for new installs
- Recommending who to send where, given travel time

I know about your work activities, clients, helpers, and Google Calendar — what would you like to look at?`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Checking your work activities…');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingMessage('Checking your work activities…');
      return;
    }
    const cycle = [
      'Checking your work activities…',
      'Analyzing your schedule…',
      'Checking helper availability…',
      'Calculating travel times…',
      'Almost done…',
    ];
    let idx = 0;
    setLoadingMessage(cycle[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % cycle.length;
      setLoadingMessage(cycle[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatApi.sendMessage(text);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: response.response,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Chat error:', error);
      let errorText = "I'm having trouble connecting right now. Try again in a moment, or check that the backend server is running.";
      const status = error.response?.status;
      if (status === 408 || error.response?.data?.timeout) {
        errorText = '⏰ **Request timed out.** Try a smaller question — e.g. "when can I fit a 4-hour job next week?"';
      } else if (status === 429 || error.response?.data?.rateLimited) {
        errorText = "🚫 **Rate limit reached.** Wait about 30 seconds and try again.";
      } else if (typeof status === 'number' && status >= 500) {
        errorText = "🔧 **Server error.** Try again in a few minutes, or check the server logs.";
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorText = '🌐 **Connection timeout.** Check your network and try again.';
      }
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: errorText,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(inputValue);
    }
  };

  return (
    <main
      data-screen-label="Assistant"
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: '20px 24px 0',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
      }}
    >
      <div className="gc-page-header" style={{ marginBottom: 12 }}>
        <div className="gc-eyebrow">AI assistant</div>
        <h1>Ask about your business</h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              gap: 14,
              padding: '20px 0',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            {m.isUser ? (
              <span className="gc-avatar" aria-hidden="true">{initialsFor(user?.name)}</span>
            ) : (
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: 'var(--moss-700)',
                  color: 'var(--linen)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={16} strokeWidth={1.8} />
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--fg-muted)',
                  marginBottom: 4,
                }}
              >
                {m.isUser ? user?.name?.split(' ')[0] || 'You' : 'Assistant'}
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--fg)' }}>
                <MarkdownMessage content={m.text} />
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '20px 0',
              color: 'var(--fg-muted)',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: 'var(--moss-700)',
                color: 'var(--linen)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={16} strokeWidth={1.8} />
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontStyle: 'italic' }}>
              <CircularProgress size={12} sx={{ color: 'var(--fg-muted)' }} />
              {loadingMessage}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '10px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SUGGESTED_PROMPTS.map((s) => (
          <button
            key={s}
            type="button"
            className="gc-btn secondary sm"
            style={{ height: 30, fontWeight: 400, color: 'var(--fg-muted)' }}
            onClick={() => send(s)}
            disabled={isLoading}
          >
            {s}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 0 20px',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about scheduling, hours, clients, helpers…"
          rows={1}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '11px 14px',
            borderRadius: 10,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            resize: 'none',
            color: 'var(--fg)',
            outline: 'none',
            minHeight: 44,
            maxHeight: 160,
            lineHeight: 1.5,
          }}
        />
        <button
          type="button"
          className="gc-btn primary"
          onClick={() => send(inputValue)}
          disabled={!inputValue.trim() || isLoading}
          aria-label="Send"
          style={{ width: 44, height: 44, padding: 0 }}
        >
          <ArrowUp size={18} strokeWidth={1.8} />
        </button>
      </div>
    </main>
  );
};

export default Chat;
