import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Avatar,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Send, Person, SmartToy } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { chatApi } from '../services/api';
import 'highlight.js/styles/github.css';

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// Custom markdown component with Claude-like styling
const MarkdownMessage: React.FC<{ content: string; isUser: boolean }> = ({ content, isUser }) => {
  if (isUser) {
    return (
      <Typography 
        variant="body1" 
        sx={{ 
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          fontSize: '15px',
        }}
      >
        {content}
      </Typography>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        h1: ({ children }) => (
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 1.5, fontSize: '20px' }}>
            {children}
          </Typography>
        ),
        h2: ({ children }) => (
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, mt: 1.5, fontSize: '18px' }}>
            {children}
          </Typography>
        ),
        h3: ({ children }) => (
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, mt: 1.5, fontSize: '16px' }}>
            {children}
          </Typography>
        ),
        p: ({ children }) => (
          <Typography 
            variant="body1" 
            sx={{ 
              mb: 1.5, 
              lineHeight: 1.6,
              fontSize: '15px',
              '&:last-child': { mb: 0 }
            }}
          >
            {children}
          </Typography>
        ),
        ul: ({ children }) => (
          <Box component="ul" sx={{ pl: 3, mb: 1.5, '& li': { mb: 0.5 } }}>
            {children}
          </Box>
        ),
        ol: ({ children }) => (
          <Box component="ol" sx={{ pl: 3, mb: 1.5, '& li': { mb: 0.5 } }}>
            {children}
          </Box>
        ),
        li: ({ children }) => (
          <Typography component="li" variant="body1" sx={{ fontSize: '15px', lineHeight: 1.6 }}>
            {children}
          </Typography>
        ),
        strong: ({ children }) => (
          <Typography component="strong" sx={{ fontWeight: 600 }}>
            {children}
          </Typography>
        ),
        em: ({ children }) => (
          <Typography component="em" sx={{ fontStyle: 'italic' }}>
            {children}
          </Typography>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <Typography
              component="code"
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                color: '#d73a49',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {children}
            </Typography>
          ) : (
            <Box
              sx={{
                backgroundColor: '#f6f8fa',
                border: '1px solid #e1e4e8',
                borderRadius: '8px',
                p: 2,
                mb: 1.5,
                overflow: 'auto',
              }}
            >
              <Typography
                component="pre"
                sx={{
                  fontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
                  fontSize: '13px',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.45,
                }}
              >
                <code className={className}>{children}</code>
              </Typography>
            </Box>
          );
        },
        blockquote: ({ children }) => (
          <Box
            sx={{
              borderLeft: '4px solid #dfe2e5',
              backgroundColor: '#f6f8fa',
              pl: 2,
              py: 1,
              mb: 1.5,
              borderRadius: '0 4px 4px 0',
            }}
          >
            {children}
          </Box>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `Hi Andrea! I'm your AI scheduling assistant for your landscaping business. I can help you optimize schedules, handle urgent requests, balance workloads, and manage your team efficiently.

**What I can help with:**
• Schedule optimization considering geography and helper capabilities
• Emergency rescheduling and urgent requests
• Workload balancing across your team
• Travel efficiency analysis and route suggestions
• Maintenance schedule management

**Try asking me:**
• "Where can I fit a 4-hour maintenance visit next week?"
• "Sarah called in sick today - help me reschedule"
• "I have an urgent install request - when's the earliest I can schedule it?"

I understand your business context including helper availability, client zones, and travel constraints. What would you like help with today?`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Thinking...');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Dynamic loading messages
  useEffect(() => {
    if (!isLoading) {
      setLoadingMessage('Thinking...');
      return;
    }

    const messages = [
      'Thinking...',
      'Analyzing your schedule...',
      'Checking helper availability...',
      'Calculating travel times...',
      'Optimizing recommendations...',
      'Almost done...'
    ];

    let messageIndex = 0;
    setLoadingMessage(messages[0]);

    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setLoadingMessage(messages[messageIndex]);
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatApi.sendMessage(inputValue);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      
      let errorText = "I'm having trouble connecting right now. Please try again in a moment, or check if your backend server is running.";
      
      // Handle specific error types from the server
      if (error.response?.status === 408 || error.response?.data?.timeout) {
        errorText = "⏰ **Request Timed Out**\n\nYour request is taking longer than expected to process. This usually happens when I need to analyze complex scheduling data or make multiple calculations.\n\n**Try:**\n• Breaking your request into smaller, more specific questions\n• Asking about a shorter time period\n• Simplifying your query\n\nFor example, instead of \"optimize my entire schedule,\" try \"when can I fit a 4-hour job next week?\"";
      } else if (error.response?.status === 429 || error.response?.data?.rateLimited) {
        errorText = "🚫 **Rate Limit Exceeded**\n\nI'm receiving too many requests right now. Please wait a moment before trying again.\n\n**This helps ensure:**\n• Fair access for all users\n• Stable system performance\n• Quality responses\n\nTry again in about 30 seconds.";
      } else if (error.response?.status >= 500) {
        errorText = "🔧 **Server Error**\n\nThere's a temporary issue with the scheduling system. This might be due to:\n• Database connectivity issues\n• External service problems\n• System maintenance\n\n**Please:**\n• Try again in a few minutes\n• Contact support if the issue persists\n• Check the server logs for more details";
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorText = "🌐 **Connection Timeout**\n\nThe request took too long to complete. This might be due to:\n• Slow network connection\n• Complex scheduling calculations\n• High server load\n\n**Try:**\n• Checking your internet connection\n• Asking a simpler question\n• Waiting a moment and trying again";
      }
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#ffffff',
    }}>
      {/* Header */}
      <Box sx={{ 
        p: 3, 
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        zIndex: 1,
      }}>
        <Typography 
          variant="h5" 
          sx={{ 
            fontWeight: 600,
            color: '#1f2937',
            textAlign: 'center',
          }}
        >
          AI Scheduling Assistant
        </Typography>
      </Box>

      {/* Messages Container */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        backgroundColor: '#ffffff',
      }}>
        <Box sx={{ maxWidth: '768px', mx: 'auto', px: 3 }}>
          {messages.map((message, index) => (
            <Box key={message.id}>
              <Box
                sx={{
                  display: 'flex',
                  gap: 3,
                  py: 4,
                  alignItems: 'flex-start',
                }}
              >
                {/* Avatar */}
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: message.isUser ? '#2563eb' : '#059669',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  {message.isUser ? <Person sx={{ fontSize: 18 }} /> : <SmartToy sx={{ fontSize: 18 }} />}
                </Avatar>

                {/* Message Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#6b7280',
                      mb: 1,
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    {message.isUser ? 'You' : 'Assistant'}
                  </Typography>
                  <Box sx={{ color: '#1f2937' }}>
                    <MarkdownMessage content={message.text} isUser={message.isUser} />
                  </Box>
                </Box>
              </Box>
              
              {/* Divider between messages */}
              {index < messages.length - 1 && (
                <Divider sx={{ borderColor: '#f3f4f6' }} />
              )}
            </Box>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <>
              <Divider sx={{ borderColor: '#f3f4f6' }} />
              <Box
                sx={{
                  display: 'flex',
                  gap: 3,
                  py: 4,
                  alignItems: 'flex-start',
                }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: '#059669',
                    fontSize: '14px',
                  }}
                >
                  <SmartToy sx={{ fontSize: 18 }} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#6b7280',
                      mb: 1,
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    Assistant
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CircularProgress size={16} sx={{ color: '#6b7280' }} />
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '15px' }}>
                      {loadingMessage}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </>
          )}
          
          <div ref={messagesEndRef} />
        </Box>
      </Box>

      {/* Input Area */}
      <Box sx={{ 
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        p: 3,
      }}>
        <Box sx={{ maxWidth: '768px', mx: 'auto' }}>
          <Box sx={{ 
            display: 'flex', 
            gap: 2,
            alignItems: 'flex-end',
          }}>
            <TextField
              fullWidth
              multiline
              maxRows={6}
              placeholder="Ask about scheduling, helper availability, client requests..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: '#f9fafb',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  '&:hover': {
                    backgroundColor: '#f3f4f6',
                  },
                  '&.Mui-focused': {
                    backgroundColor: '#ffffff',
                  },
                  '& fieldset': {
                    borderColor: '#d1d5db',
                  },
                  '&:hover fieldset': {
                    borderColor: '#9ca3af',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#2563eb',
                    borderWidth: '2px',
                  },
                },
                '& .MuiInputBase-input': {
                  py: 1.5,
                  px: 2,
                },
              }}
            />
            <IconButton
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              sx={{
                backgroundColor: inputValue.trim() && !isLoading ? '#2563eb' : '#e5e7eb',
                color: inputValue.trim() && !isLoading ? '#ffffff' : '#9ca3af',
                width: 40,
                height: 40,
                borderRadius: '8px',
                '&:hover': {
                  backgroundColor: inputValue.trim() && !isLoading ? '#1d4ed8' : '#e5e7eb',
                },
                '&:disabled': {
                  backgroundColor: '#e5e7eb',
                  color: '#9ca3af',
                },
              }}
            >
              <Send sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Chat; 