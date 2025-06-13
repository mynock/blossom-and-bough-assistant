import React, { useState, useRef, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Send, Psychology } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { chatApi } from '../services/api';
import 'highlight.js/styles/github.css'; // Add syntax highlighting styles

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// Custom markdown component with styling
const MarkdownMessage: React.FC<{ content: string; isUser: boolean }> = ({ content, isUser }) => {
  if (isUser) {
    // User messages don't need markdown parsing
    return (
      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
        {content}
      </Typography>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // Custom styling for markdown elements
        h1: ({ children }) => (
          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, mt: 1 }}>
            {children}
          </Typography>
        ),
        h2: ({ children }) => (
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, mt: 1 }}>
            {children}
          </Typography>
        ),
        h3: ({ children }) => (
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5, mt: 1 }}>
            {children}
          </Typography>
        ),
        p: ({ children }) => (
          <Typography variant="body1" sx={{ mb: 1, lineHeight: 1.6 }}>
            {children}
          </Typography>
        ),
        ul: ({ children }) => (
          <Box component="ul" sx={{ pl: 2, mb: 1 }}>
            {children}
          </Box>
        ),
        ol: ({ children }) => (
          <Box component="ol" sx={{ pl: 2, mb: 1 }}>
            {children}
          </Box>
        ),
        li: ({ children }) => (
          <Typography component="li" variant="body1" sx={{ mb: 0.5 }}>
            {children}
          </Typography>
        ),
        strong: ({ children }) => (
          <Typography component="strong" sx={{ fontWeight: 'bold' }}>
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
                backgroundColor: 'grey.200',
                padding: '2px 4px',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            >
              {children}
            </Typography>
          ) : (
            <Paper
              sx={{
                backgroundColor: 'grey.100',
                p: 2,
                mb: 1,
                borderRadius: 1,
                overflow: 'auto',
              }}
            >
              <Typography
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <code className={className}>{children}</code>
              </Typography>
            </Paper>
          );
        },
        blockquote: ({ children }) => (
          <Paper
            sx={{
              borderLeft: 4,
              borderColor: 'primary.main',
              backgroundColor: 'grey.50',
              p: 2,
              mb: 1,
              fontStyle: 'italic',
            }}
          >
            {children}
          </Paper>
        ),
        table: ({ children }) => (
          <Paper sx={{ overflow: 'auto', mb: 1 }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
              {children}
            </Box>
          </Paper>
        ),
        th: ({ children }) => (
          <Typography
            component="th"
            sx={{
              border: 1,
              borderColor: 'grey.300',
              p: 1,
              backgroundColor: 'grey.100',
              fontWeight: 'bold',
              textAlign: 'left',
            }}
          >
            {children}
          </Typography>
        ),
        td: ({ children }) => (
          <Typography
            component="td"
            sx={{
              border: 1,
              borderColor: 'grey.300',
              p: 1,
            }}
          >
            {children}
          </Typography>
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
      text: `# Welcome to Your AI Scheduling Assistant! 🌿

Hi **Andrea**! I'm your intelligent scheduling assistant for your landscaping business. I can help you:

## What I Can Do:
- **Optimize schedules** considering geographic efficiency and helper capabilities
- **Handle emergency requests** and urgent rescheduling
- **Balance workloads** across your team members
- **Analyze travel efficiency** and suggest route improvements
- **Manage maintenance schedules** and client preferences

## Quick Examples:
- *"Where can I fit a 4-hour maintenance visit next week?"*
- *"Sarah called in sick today - help me reschedule"*
- *"I have an urgent install request - when's the earliest I can schedule it?"*

Just ask me anything about your schedule, and I'll provide specific, actionable recommendations!

> 💡 **Tip**: I understand your business context including helper availability, client zones, and travel constraints.`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting right now. Please try again in a moment, or check if your backend server is running.",
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const quickPrompts = [
    "Where can I fit a 4-hour maintenance visit next week?",
    "Sarah called in sick today - help me reschedule",
    "I have an urgent install request - when's the earliest I can schedule it?",
    "Show me this week's schedule efficiency",
    "Help me plan around Mike's vacation next month"
  ];

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom align="center" sx={{ mb: 3 }}>
        AI Scheduling Assistant
      </Typography>

      {/* Quick Action Prompts */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {quickPrompts.map((prompt, index) => (
            <Button
              key={index}
              variant="outlined"
              size="small"
              onClick={() => setInputValue(prompt)}
              sx={{ 
                textTransform: 'none',
                borderRadius: 2,
                fontSize: '0.8rem'
              }}
            >
              {prompt}
            </Button>
          ))}
        </Box>
      </Box>

      {/* Chat Messages */}
      <Paper sx={{ height: '500px', display: 'flex', flexDirection: 'column', mb: 2 }}>
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: message.isUser ? 'flex-end' : 'flex-start',
                mb: 2,
              }}
            >
              <Card
                sx={{
                  maxWidth: '70%',
                  bgcolor: message.isUser ? 'primary.main' : 'grey.100',
                  color: message.isUser ? 'white' : 'text.primary',
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    {!message.isUser && <Psychology sx={{ mr: 1, fontSize: '1rem' }} />}
                    <Typography variant="body2" sx={{ opacity: 0.8, fontSize: '0.75rem' }}>
                      {message.isUser ? 'You' : 'AI Assistant'} • {formatTime(message.timestamp)}
                    </Typography>
                  </Box>
                  <MarkdownMessage content={message.text} isUser={message.isUser} />
                </CardContent>
              </Card>
            </Box>
          ))}
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
              <Card sx={{ bgcolor: 'grey.100' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    AI is thinking...
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={3}
              placeholder="Ask about scheduling, helper availability, client requests..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              variant="outlined"
              size="small"
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              sx={{ alignSelf: 'flex-end' }}
            >
              <Send />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Chat; 