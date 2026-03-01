'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, MessageCircle } from 'lucide-react';
import { MascotMini } from './Mascot';
import { usePathname } from 'next/navigation';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const mockAIResponses: Record<string, string> = {
  hello: "Hey there! I'm Pip, your AI health companion. I'm here to help you understand your health better and answer any questions you have!",
  health: "Your health is important! Based on your profile, I can see some areas we can work on together. Would you like me to provide specific recommendations?",
  risk: "Looking at your risk assessment, we've identified a few areas to focus on. The good news is that many health risks can be reduced with lifestyle changes!",
  appointment: "I can help you schedule an appointment with a healthcare provider. Would you like to check available slots?",
  default: "That's a great question! I'd love to help. Could you tell me more about what you're interested in?",
};

const suggestionChips = [
  'Tell me about my health',
  'How do I lower my risk?',
  'Schedule an appointment',
];

function getAIResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  if (lower.includes('hello') || lower.includes('hi')) return mockAIResponses.hello;
  if (lower.includes('health')) return mockAIResponses.health;
  if (lower.includes('risk')) return mockAIResponses.risk;
  if (lower.includes('appointment') || lower.includes('book')) return mockAIResponses.appointment;
  return mockAIResponses.default;
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 p-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-primary animate-bounce"
          style={{
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

export function FloatingChat() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! I\'m Pip, your AI health companion. How can I help you today?',
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Only show on app routes
  const isAppRoute = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/appointments') ||
    pathname.startsWith('/risk-assessment') ||
    pathname.startsWith('/profile');

  if (!isAppRoute) return null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: getAIResponse(text),
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 800);
  };

  const handleSuggestion = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {isOpen && (
        <div
          className="absolute bottom-20 right-0 w-96 h-[560px] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300"
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-rose-400 text-primary-foreground p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <MascotMini size={40} />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Pip's Health Chat</h3>
                  <p className="text-xs opacity-90">Always here to help</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Disclaimer */}
            <div className="bg-primary/5 border-b border-border px-4 py-2 flex items-start gap-2 text-xs text-muted-foreground">
              <div className="mt-0.5 flex-shrink-0">ℹ️</div>
              <p>Pip provides general health information and is not a substitute for professional medical advice.</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.sender === 'ai' && (
                    <div className="flex-shrink-0 mr-2">
                      <MascotMini size={24} />
                    </div>
                  )}
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex-shrink-0 mr-2">
                    <MascotMini size={24} />
                  </div>
                  <div className="bg-muted rounded-lg rounded-bl-none">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              {!isTyping && messages.length === 1 && (
                <div className="flex flex-col gap-2 mt-4">
                  <p className="text-xs text-muted-foreground font-medium">Suggested questions:</p>
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleSuggestion(chip)}
                      className="text-left text-xs px-3 py-2 rounded-full bg-muted text-foreground hover:bg-primary/10 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border bg-card p-3 flex gap-2">
              <button className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                <Paperclip className="w-4 h-4 text-foreground" />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage(inputValue);
                  }
                }}
                placeholder="Ask Pip anything..."
                className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
              <button
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim()}
                className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-rose-400 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center group"
      >
        <div
          className="absolute inset-0 rounded-full border-2 border-primary opacity-0 group-hover:opacity-50 animate-pulse"
        />
        <div
          className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"
        />
        {!isOpen ? (
          <MessageCircle className="w-6 h-6" />
        ) : (
          <X className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}
