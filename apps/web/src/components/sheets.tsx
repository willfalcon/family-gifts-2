// Mobile's page sheets that open from several screens: Private idea, Ask for
// ideas, and the Secret Santa Ask. Dialogs here.
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { formatDistanceToNowStrict } from 'date-fns';
import { Lightbulb, Lock, MessageCircle, Plus } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { confirm } from '@/components/alerts';
import { ErrorText } from '@/components/auth-forms';
import { Avatar } from '@/components/avatar';
import { ActionsMenu } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/controls';
import { SheetDialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { formatOccasionDate } from '@/lib/occasion';
import { cn, errorMessage, localToday } from '@/lib/utils';

// ---- Private ideas ----

// Add or edit a private idea for someone. Pass `idea` to edit it.
export function PrivateIdeaDialog({
  open,
  onClose,
  forUserId,
  personName,
  idea,
}: {
  open: boolean;
  onClose: () => void;
  forUserId: string;
  personName?: string;
  idea?: Doc<'privateIdeas'> | null;
}) {
  const createIdea = useMutation(api.privateIdeas.create);
  const updateIdea = useMutation(api.privateIdeas.update);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(idea?.title ?? '');
    setDescription(idea?.description ?? '');
    setError(null);
  }, [open, idea]);

  const save = async () => {
    if (!title.trim()) {
      setError('Give your idea a title.');
      return;
    }
    setSaving(true);
    try {
      const fields = { title, description: description || undefined };
      if (idea) await updateIdea({ id: idea._id, ...fields });
      else await createIdea({ forUserId, ...fields });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={o => !o && onClose()}
      title={idea ? 'Edit Idea' : 'Private Idea'}
      action={{ label: idea ? 'Save' : 'Add', onClick: save, disabled: saving }}
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Lock className="size-3.5" />
          Only you can see this{personName ? ` — ${personName} won’t` : ''}.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idea-title">Title</Label>
          <Input
            id="idea-title"
            placeholder="e.g. Pottery class"
            autoFocus
            value={title}
            onChange={e => {
              setTitle(e.target.value);
              setError(null);
            }}
            aria-invalid={!!error}
          />
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idea-description">Description (optional)</Label>
          <Textarea
            id="idea-description"
            placeholder="Where to get it, why they’d like it..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </form>
    </SheetDialog>
  );
}

// One of your private ideas for someone. Click to edit; the menu deletes.
export function PrivateIdeaRow({
  idea,
  onEdit,
}: {
  idea: Doc<'privateIdeas'>;
  onEdit: (idea: Doc<'privateIdeas'>) => void;
}) {
  const removeIdea = useMutation(api.privateIdeas.remove);
  async function confirmDelete() {
    if (await confirm({ title: 'Delete this idea?', confirmText: 'Delete', destructive: true })) {
      void removeIdea({ id: idea._id });
    }
  }
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onEdit(idea)} className="flex min-w-0 flex-1 gap-3 py-2 text-left">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-fill">
          <Lightbulb className="size-5 text-ink-muted" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center border-b border-line pb-2">
          <span className="truncate text-lg">{idea.title}</span>
          {idea.description && <span className="line-clamp-2 text-sm text-ink-muted">{idea.description}</span>}
        </span>
      </button>
      <ActionsMenu
        label={`Options for ${idea.title}`}
        actions={[
          { label: 'Edit', onSelect: () => onEdit(idea) },
          { label: 'Delete', onSelect: confirmDelete, destructive: true },
        ]}
      />
    </div>
  );
}

// ---- Asks ----

// Lines you can click to add to the message.
export const SUGGESTIONS = ['Any sizes?', 'What are you into lately?', 'Experiences count too'];

function ago(time: number) {
  return formatDistanceToNowStrict(time, { addSuffix: true });
}

function Suggestions({ used, onAdd }: { used: string[]; onAdd: (line: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTIONS.filter(s => !used.includes(s)).map(line => (
        <button
          key={line}
          type="button"
          aria-label={`Add “${line}”`}
          onClick={() => onAdd(line)}
          className="flex items-center gap-1 rounded-pill border border-line px-3 py-1.5 text-subhead hover:bg-fill"
        >
          <Plus className="size-3.5 text-accent" />
          {line}
        </button>
      ))}
    </div>
  );
}

// Ask for ideas (see Ask in GLOSSARY.md). Asking from an event's page fixes
// the occasion to that event.
export function AskForIdeasDialog({
  open,
  onClose,
  userId,
  eventId,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  eventId?: string;
}) {
  const compose = useQuery(api.asks.compose, open ? { userId, eventId, today: localToday() } : 'skip');
  const send = useMutation(api.asks.send);
  const [optionKey, setOptionKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOptionKey(null);
    setEdited(false);
    setUsedSuggestions([]);
    setError(null);
  }, [open]);

  // Soonest occasion first; "No occasion" is last.
  const option = compose?.options.find(o => o.key === optionKey) ?? compose?.options[0];

  useEffect(() => {
    if (!compose || edited) return;
    const phrase = option?.phrase ? ` for ${option.phrase}` : '';
    setMessage(`Hey ${compose.firstName}! Any gift ideas${phrase}?`);
  }, [compose?.firstName, option?.key, edited]);

  const addSuggestion = (line: string) => {
    setMessage(m => (m.trim() ? `${m.trimEnd()} ${line}` : line));
    setUsedSuggestions(s => [...s, line]);
    setEdited(true);
  };

  const submit = async () => {
    if (!compose || !option) return;
    if (!message.trim()) {
      setError('Write a message first.');
      return;
    }
    setSending(true);
    try {
      await send({ askedId: userId, occasion: option.occasion ?? undefined, body: message, today: localToday() });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={o => !o && onClose()}
      title="Ask for Ideas"
      action={{ label: 'Send', onClick: submit, disabled: !compose?.canAsk || !option || sending }}
    >
      <div className="flex flex-col gap-6">
        {compose && (
          <div className="flex flex-col items-center gap-2">
            <Avatar person={compose} size={64} />
            <p className="text-lg font-semibold">{compose.name}</p>
          </div>
        )}
        {compose && !compose.canAsk && (
          <p className="text-center text-ink-muted">You can only ask people you share a group or event with.</p>
        )}
        {compose && compose.options.length > 1 && (
          <div className="flex flex-col gap-2">
            <Label>For</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {compose.options.map(o => {
                const selected = o.key === option?.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setOptionKey(o.key)}
                    className={cn(
                      'rounded-pill border px-3 py-1.5 text-subhead',
                      selected
                        ? 'border-accent bg-accent font-semibold text-accent-foreground'
                        : 'border-line hover:bg-fill',
                    )}
                  >
                    {o.label}
                    {o.date ? ` · ${formatOccasionDate(o.date)}` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {option && (option.myAskedAt !== null || option.otherAskers.length > 0) && (
          <div className="flex flex-col gap-1 rounded-xl bg-fill p-3 text-subhead">
            {option.myAskedAt !== null && <p>You asked {ago(option.myAskedAt)}. This will be added to your Ask.</p>}
            {option.otherAskers.map(asker => (
              <p key={`${asker.name}-${asker.askedAt}`} className="text-ink-muted">
                {asker.name} asked {ago(asker.askedAt)}
              </p>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ask-message">Message</Label>
          <Textarea
            id="ask-message"
            value={message}
            onChange={e => {
              setMessage(e.target.value);
              setEdited(true);
              setError(null);
            }}
            aria-invalid={!!error}
          />
          <ErrorText>{error}</ErrorText>
        </div>
        <Suggestions used={usedSuggestions} onAdd={addSuggestion} />
      </div>
    </SheetDialog>
  );
}

type SantaMatch = NonNullable<FunctionReturnType<typeof api.asks.secretSanta>>;

// Under your Match, once revealed: ask them for ideas without your name, or
// open the Thread once you have.
export function SecretSantaAsk({ eventId }: { eventId: Id<'events'> }) {
  const match = useQuery(api.asks.secretSanta, { eventId, today: localToday() });
  const [asking, setAsking] = useState(false);
  if (!match) return null;

  if (match.threadId) {
    return (
      <Button asChild variant="secondary" className="self-start">
        <Link to="/messages/$id" params={{ id: match.threadId }}>
          <MessageCircle className="text-accent" />
          <span className="text-accent">Message {match.firstName}</span>
        </Link>
      </Button>
    );
  }
  if (!match.canAsk) return null;
  return (
    <>
      <Button variant="secondary" className="self-start" onClick={() => setAsking(true)}>
        <MessageCircle className="text-accent" />
        <span className="text-accent">Ask for ideas anonymously</span>
      </Button>
      <SecretSantaAskDialog open={asking} onClose={() => setAsking(false)} eventId={eventId} match={match} />
    </>
  );
}

function SecretSantaAskDialog({
  open,
  onClose,
  eventId,
  match,
}: {
  open: boolean;
  onClose: () => void;
  eventId: Id<'events'>;
  match: SantaMatch;
}) {
  const send = useMutation(api.asks.sendSecretSanta);
  const [message, setMessage] = useState('');
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setUsedSuggestions([]);
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!message.trim()) {
      setError('Write a message first.');
      return;
    }
    setSending(true);
    try {
      await send({ eventId, body: message, today: localToday() });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={o => !o && onClose()}
      title="Ask Anonymously"
      action={{ label: 'Send', onClick: submit, disabled: sending || !message.trim() }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar person={match} size={64} />
          <p className="text-lg font-semibold">{match.name}</p>
          <p className="text-subhead text-ink-muted">
            {match.firstName} won’t see your name. They can reply to “Your Secret Santa”.
          </p>
        </div>
        {match.myAskedAt !== null && (
          <p className="rounded-xl bg-fill p-3 text-subhead">
            You asked {ago(match.myAskedAt)}. This will be added to your Ask.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="santa-ask-message">Message</Label>
          <Textarea
            id="santa-ask-message"
            placeholder={`What would you like to ask ${match.firstName}?`}
            value={message}
            onChange={e => {
              setMessage(e.target.value);
              setError(null);
            }}
            aria-invalid={!!error}
          />
          <ErrorText>{error}</ErrorText>
        </div>
        <Suggestions
          used={usedSuggestions}
          onAdd={line => {
            setMessage(m => (m.trim() ? `${m.trimEnd()} ${line}` : line));
            setUsedSuggestions(s => [...s, line]);
          }}
        />
      </div>
    </SheetDialog>
  );
}
