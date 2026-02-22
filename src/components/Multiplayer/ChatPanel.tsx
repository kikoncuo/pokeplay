'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  localUserId: string;
  disabled?: boolean;
  onSend: (text: string) => void;
}

const MAX_MESSAGE_LENGTH = 200;

export function ChatPanel({
  messages,
  localUserId,
  disabled = false,
  onSend,
}: ChatPanelProps): React.ReactElement {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleSend(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setDraft('');
  }

  return (
    <Card className="flex flex-col w-full border border-border shadow-[3px_3px_0px_0px] shadow-foreground">
      <CardHeader className="border-b border-border pb-3 shrink-0">
        <CardTitle className="font-mono text-sm font-bold uppercase tracking-widest">
          Chat
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-0 min-h-0">
        <ScrollArea className="h-48 px-3 pt-2">
          {messages.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-muted-foreground">
              No messages yet.
            </p>
          ) : (
            <div className="space-y-2 pb-2">
              {messages.map((msg) => (
                <ChatMessageRow
                  key={msg.id}
                  message={msg}
                  isLocal={msg.userId === localUserId}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <CardFooter className="border-t border-border p-2 shrink-0">
        <form onSubmit={handleSend} className="flex w-full gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder={disabled ? 'Chat unavailable' : 'Say something...'}
            disabled={disabled}
            className="flex-1 border border-border font-mono text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={disabled || !draft.trim()}
            className="font-mono text-xs shrink-0"
          >
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

interface ChatMessageRowProps {
  message: ChatMessage;
  isLocal: boolean;
}

function ChatMessageRow({ message, isLocal }: ChatMessageRowProps): React.ReactElement {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex flex-col gap-0.5 ${isLocal ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-1">
        <span className="font-mono text-[10px] text-muted-foreground">{time}</span>
        <Badge
          variant={isLocal ? 'default' : 'secondary'}
          className="font-mono text-[10px] px-1 py-0 h-4"
        >
          {message.username}
        </Badge>
      </div>
      <p
        className={`max-w-[80%] rounded-none border px-2 py-1 font-mono text-xs break-words ${
          isLocal
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-muted text-foreground'
        }`}
      >
        {message.text}
      </p>
    </div>
  );
}
