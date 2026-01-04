import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, User, Bot, Loader, Plus, Archive, Trash2,
  MessageSquare, Clock, ChevronLeft, MoreVertical, FolderArchive
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AskBrainProps { }

// API Service functions for conversations
const conversationApi = {
  getConversations: async (filter?: 'all' | 'archived' | 'active'): Promise<Conversation[]> => {
    const res = await fetch(`/api/conversations${filter ? `?filter=${filter}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  createConversation: async (): Promise<Conversation> => {
    const res = await fetch('/api/conversations', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create conversation');
    return res.json();
  },

  getConversation: async (id: string): Promise<Conversation & { messages: Message[] }> => {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) throw new Error('Failed to fetch conversation');
    return res.json();
  },

  updateConversation: async (id: string, data: Partial<Conversation>): Promise<Conversation> => {
    const res = await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update conversation');
    return res.json();
  },

  deleteConversation: async (id: string): Promise<void> => {
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete conversation');
  },

  sendMessage: async (id: string, content: string): Promise<{ userMessage: Message, aiMessage: Message }> => {
    const res = await fetch(`/api/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  }
};

// Format date to YYYY-MM-DD HH:mm
const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Group conversations by date
const groupConversationsByDate = (conversations: Conversation[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 Days', items: [] },
    { label: 'Earlier', items: [] }
  ];

  conversations.forEach(c => {
    const date = new Date(c.updatedAt);
    date.setHours(0, 0, 0, 0);

    if (date >= today) {
      groups[0].items.push(c);
    } else if (date >= yesterday) {
      groups[1].items.push(c);
    } else if (date >= lastWeek) {
      groups[2].items.push(c);
    } else {
      groups[3].items.push(c);
    }
  });

  return groups.filter(g => g.items.length > 0);
};

export const AskBrain: React.FC<AskBrainProps> = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const [active, archived] = await Promise.all([
        conversationApi.getConversations('active'),
        conversationApi.getConversations('archived')
      ]);
      setConversations(active);
      setArchivedConversations(archived);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  };

  const handleNewChat = async () => {
    try {
      const conv = await conversationApi.createConversation();
      setConversations(prev => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setMessages([]);
    } catch (e) {
      console.error('Failed to create conversation:', e);
    }
  };

  const handleSelectConversation = async (id: string) => {
    try {
      const conv = await conversationApi.getConversation(id);
      setActiveConversationId(id);
      setMessages(conv.messages || []);
    } catch (e) {
      console.error('Failed to load conversation:', e);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await conversationApi.updateConversation(id, { isArchived: true });
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
      loadConversations();
      setMenuOpenFor(null);
    } catch (e) {
      console.error('Failed to archive:', e);
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      await conversationApi.updateConversation(id, { isArchived: false });
      loadConversations();
      setMenuOpenFor(null);
    } catch (e) {
      console.error('Failed to unarchive:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this conversation?')) return;
    try {
      await conversationApi.deleteConversation(id);
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
      loadConversations();
      setMenuOpenFor(null);
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  const handleSend = async () => {
    if (!query.trim() || isLoading) return;

    // Auto-create conversation if none selected
    let convId = activeConversationId;
    if (!convId) {
      try {
        const conv = await conversationApi.createConversation();
        setConversations(prev => [conv, ...prev]);
        convId = conv.id;
        setActiveConversationId(convId);
      } catch (e) {
        console.error('Failed to create conversation:', e);
        return;
      }
    }

    const userContent = query.trim();
    setQuery('');
    setIsLoading(true);

    // Optimistic update for user message
    const tempUserMsg: Message = {
      id: 'temp-user-' + Date.now(),
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const { userMessage, aiMessage } = await conversationApi.sendMessage(convId, userContent);
      // Replace temp message with real ones
      setMessages(prev => [...prev.slice(0, -1), userMessage, aiMessage]);
      // Refresh conversations to update title and timestamp
      loadConversations();
    } catch (e) {
      console.error('Failed to send message:', e);
      setMessages(prev => [
        ...prev,
        {
          id: 'error-' + Date.now(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConversationId)
    || archivedConversations.find(c => c.id === activeConversationId);
  const displayConversations = showArchived ? archivedConversations : conversations;
  const groupedConversations = groupConversationsByDate(displayConversations);

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-slate-200 flex flex-col bg-slate-50">
        {/* New Chat Button */}
        <div className="p-3 border-b border-slate-200">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Toggle Active/Archived */}
        <div className="flex p-2 gap-1 border-b border-slate-200">
          <button
            onClick={() => setShowArchived(false)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors ${!showArchived ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            Chats
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${showArchived ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            Archived
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {groupedConversations.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              {showArchived ? 'No archived chats' : 'No conversations yet'}
            </div>
          ) : (
            groupedConversations.map(group => (
              <div key={group.label}>
                <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                  {group.label}
                </div>
                {group.items.map(conv => (
                  <div
                    key={conv.id}
                    className={`group relative px-3 py-2 cursor-pointer hover:bg-slate-100 transition-colors ${activeConversationId === conv.id ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''
                      }`}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-700 truncate">
                          {conv.title}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(conv.updatedAt)}
                        </div>
                      </div>
                      {/* Menu Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenFor(menuOpenFor === conv.id ? null : conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    {/* Dropdown Menu */}
                    {menuOpenFor === conv.id && (
                      <div className="absolute right-2 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10">
                        {showArchived ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUnarchive(conv.id); }}
                            className="w-full px-3 py-1.5 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Archive className="w-4 h-4" /> Unarchive
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleArchive(conv.id); }}
                            className="w-full px-3 py-1.5 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Archive className="w-4 h-4" /> Archive
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                          className="w-full px-3 py-1.5 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {activeConv && (
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-800">{activeConv.title}</h3>
            <p className="text-xs text-slate-400">
              Created: {formatDateTime(activeConv.createdAt)} · Last: {formatDateTime(activeConv.updatedAt)}
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeConversationId && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Bot className="w-16 h-16 mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">Ask Your Brain</h3>
              <p className="text-sm text-center max-w-md">
                I remember everything you've logged. Ask me about past solutions, code snippets, or tech decisions.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed ${msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-100 text-slate-800 rounded-tl-none'
                    }`}>
                    {msg.role === 'assistant' ? <MarkdownRenderer content={msg.content} /> : msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Loader className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-none p-4 text-slate-500 text-sm">
                    Thinking...
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask about your work history..."
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !query.trim()}
              className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
