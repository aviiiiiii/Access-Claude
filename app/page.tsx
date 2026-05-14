'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { WORKFLOWS } from '@/lib/workflows';

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: 'text' | 'document' | 'image';
  text?: string;
  source?: { type: string; media_type: string; data: string };
}

interface FileAttachment {
  name: string;
  base64: string;
  mediaType: string;
  type: 'document' | 'image';
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = () => rej(new Error('Read failed'));
        r.readAsDataURL(file);
      });
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      if (isPdf || isImage) {
        newAttachments.push({
          name: file.name,
          base64,
          mediaType: file.type,
          type: isPdf ? 'document' : 'image',
        });
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const triggerWorkflow = (workflowId: string) => {
    const wf = WORKFLOWS.find(w => w.id === workflowId);
    if (!wf) return;
    setActiveWorkflow(workflowId === activeWorkflow ? null : workflowId);
    if (workflowId !== activeWorkflow) {
      setInput(prev => prev || `Run the ${wf.label} workflow on the uploaded file / context above.`);
      textareaRef.current?.focus();
    }
  };

  const buildUserContent = (text: string): string | ContentBlock[] => {
    if (attachments.length === 0) return text;
    const blocks: ContentBlock[] = attachments.map(att => ({
      type: att.type,
      source: { type: 'base64', media_type: att.mediaType, data: att.base64 },
    }));
    blocks.push({ type: 'text', text });
    return blocks;
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userContent = buildUserContent(input.trim() || 'Please analyze the uploaded file.');
    const userMessage: Message = { role: 'user', content: userContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    // Build API-safe messages (strip large base64 from history to save tokens)
    const apiMessages = newMessages.map((m, idx) => {
      if (idx === newMessages.length - 1) return m; // keep latest full
      if (Array.isArray(m.content)) {
        return {
          ...m,
          content: m.content.map(block =>
            block.type === 'document' || block.type === 'image'
              ? { type: 'text', text: '[file attached earlier]' }
              : block
          ),
        };
      }
      return m;
    });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          workflowId: activeWorkflow || null,
        }),
      });

      if (!res.ok) throw new Error('API error');

      const assistantMessage: Message = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMessage]);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              assistantText += data.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantText };
                return updated;
              });
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Error connecting to API. Check your ANTHROPIC_API_KEY environment variable.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setActiveWorkflow(null);
    setAttachments([]);
    setInput('');
  };

  const getMessageText = (content: string | ContentBlock[]): string => {
    if (typeof content === 'string') return content;
    const textBlock = content.find(b => b.type === 'text');
    return textBlock?.text || '';
  };

  const hasFile = (content: string | ContentBlock[]): boolean => {
    if (typeof content === 'string') return false;
    return content.some(b => b.type === 'document' || b.type === 'image');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? '280px' : '0',
        minWidth: sidebarOpen ? '280px' : '0',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 32, height: 32, background: 'var(--accent)', borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 800, color: 'white', fontFamily: 'var(--font-display)',
            }}>QA</div>
            <div>
              <div style={{ fontSize: '0.99rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>QA Assistant</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Internal AI Tool</div>
            </div>
          </div>
        </div>

        {/* Workflows */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
            WORKFLOWS
          </div>
          {WORKFLOWS.map(wf => (
            <button
              key={wf.id}
              onClick={() => triggerWorkflow(wf.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: activeWorkflow === wf.id ? 'var(--accent-dim)' : 'transparent',
                border: activeWorkflow === wf.id ? '1px solid var(--accent)' : '1px solid transparent',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                marginBottom: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (activeWorkflow !== wf.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={e => {
                if (activeWorkflow !== wf.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontSize: '14px' }}>{wf.icon}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: activeWorkflow === wf.id ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {wf.label}
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: '22px', lineHeight: 1.4, fontFamily: 'var(--font-mono)' }}>
                {wf.description}
              </div>
            </button>
          ))}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={clearChat}
            style={{
              width: '100%', padding: '8px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 600, transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--red)';
              (e.currentTarget as HTMLElement).style.color = 'var(--red)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
          >
            Clear Chat
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-panel)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '18px', padding: '4px' }}
            >
              ☰
            </button>
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {activeWorkflow ? WORKFLOWS.find(w => w.id === activeWorkflow)?.label : 'Chat'}
              </span>
              {activeWorkflow && (
                <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '20px', fontFamily: 'var(--font-mono)' }}>
                  WORKFLOW ACTIVE
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {messages.length > 0 ? `${messages.length} messages` : 'New session'}
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
              <div style={{ fontSize: '48px', opacity: 0.3 }}>🎭</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
                   QA Assistant
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', maxWidth: '380px', lineHeight: 1.6 }}>
                  Select a workflow from the sidebar or start typing.
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '500px', marginTop: '8px' }}>
                {WORKFLOWS.map(wf => (
                  <button
                    key={wf.id}
                    onClick={() => triggerWorkflow(wf.id)}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '6px 12px',
                      color: 'var(--text-secondary)', fontSize: '0.78rem',
                      cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }}
                  >
                    {wf.icon} {wf.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 20px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: '12px',
                  marginBottom: '20px',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
                    border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: msg.role === 'user' ? 'white' : 'var(--green)',
                  }}>
                    {msg.role === 'user' ? 'U' : '✦'}
                  </div>
                  <div style={{
                    maxWidth: '78%',
                    background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--bg-card)',
                    border: `1px solid ${msg.role === 'user' ? 'rgba(74,74,255,0.3)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 16px',
                  }}>
                    {hasFile(msg.content) && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        marginBottom: '8px', padding: '5px 10px',
                        background: 'var(--green-dim)', borderRadius: '4px',
                        fontSize: '0.72rem', color: 'var(--green)', fontFamily: 'var(--font-mono)',
                      }}>
                        📎 File attached
                      </div>
                    )}
                    {msg.role === 'assistant' ? (
                      <div className="markdown">
                        <ReactMarkdown>{getMessageText(msg.content)}</ReactMarkdown>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {getMessageText(msg.content)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', fontSize: '13px' }}>✦</div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                        animation: 'pulse 1.2s ease-in-out infinite',
                        animationDelay: `${i * 0.2}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{
          padding: '16px 20px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-panel)',
        }}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {attachments.map((att, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'var(--green-dim)', border: '1px solid rgba(0,255,136,0.25)',
                    borderRadius: '6px', padding: '4px 10px',
                    fontSize: '0.72rem', color: 'var(--green)', fontFamily: 'var(--font-mono)',
                  }}>
                    📎 {att.name}
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', marginLeft: '2px' }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Active workflow indicator */}
            {activeWorkflow && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--accent-dim)', border: '1px solid rgba(74,74,255,0.3)',
                borderRadius: '6px', padding: '6px 12px', marginBottom: '10px',
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                  ⚡ {WORKFLOWS.find(w => w.id === activeWorkflow)?.label} workflow active
                </span>
                <button onClick={() => setActiveWorkflow(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}>
                  ×
                </button>
              </div>
            )}

            {/* Textarea + actions */}
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'flex-end',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '10px 12px',
              transition: 'border-color 0.15s',
            }}
              onFocus={() => {}}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload PDF or image"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '18px',
                  padding: '4px', flexShrink: 0, transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
              >
                📎
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message or drop a file... (Shift+Enter for new line)"
                rows={1}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'none',
                  fontFamily: 'var(--font-display)', lineHeight: 1.6,
                  maxHeight: '150px', overflowY: 'auto',
                }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 150) + 'px';
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                style={{
                  background: isLoading || (!input.trim() && attachments.length === 0) ? 'var(--bg-hover)' : 'var(--accent)',
                  border: 'none', borderRadius: '8px', padding: '8px 14px',
                  color: 'white', fontSize: '0.82rem', fontWeight: 700,
                  cursor: isLoading || (!input.trim() && attachments.length === 0) ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-display)', flexShrink: 0, transition: 'all 0.15s',
                  opacity: isLoading || (!input.trim() && attachments.length === 0) ? 0.5 : 1,
                }}
              >
                {isLoading ? '...' : 'Send'}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              multiple
              style={{ display: 'none' }}
              onChange={e => e.target.files && handleFileUpload(e.target.files)}
            />
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Supports PDF, PNG, JPG · Drag & drop files · Enter to send
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
