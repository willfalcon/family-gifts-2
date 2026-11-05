import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { ArrowUp } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { showError } from '@/components/alerts';
import { Avatar } from '@/components/avatar';
import { MakeListButton } from '@/components/home';
import { NotFound, Page, PageHeader } from '@/components/page';
import { makeListSearch, threadTitle } from '@/components/threads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, localToday } from '@/lib/utils';

export const Route = createFileRoute('/_app/messages/$id')({
  head: () => ({ meta: [{ title: 'Message · Family Gifts' }] }),
  component: Thread,
});

// One Thread: its messages, a way to make the list an open Ask is asking
// for, and a box to reply.
function Thread() {
  const { id } = Route.useParams();
  const thread = useQuery(api.threads.get, { id, today: localToday() });
  const markRead = useMutation(api.threads.markRead);
  const send = useMutation(api.threads.send);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // Reading the Thread clears its unread count, including for messages that
  // arrive while it's open.
  const lastMessageId = thread?.messages.at(-1)?._id;
  useEffect(() => {
    if (thread?._id) markRead({ id: thread._id }).catch(() => {});
  }, [thread?._id, lastMessageId]);

  // Keep the newest message in view.
  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [lastMessageId]);

  if (thread === null) return <NotFound message="This conversation doesn’t exist or you’re not in it." />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!thread || sending || !draft.trim()) return;
    setSending(true);
    try {
      await send({ id: thread._id, body: draft });
      setDraft('');
    } catch (err) {
      showError('Couldn’t send', err);
    } finally {
      setSending(false);
    }
  }

  return (
    <Page className="gap-4 pb-44 sm:pb-40">
      <PageHeader title={thread ? threadTitle(thread) : ''} fallback="/messages" />

      {thread?.secretSanta === 'giver' && (
        <p className="text-center text-footnote text-ink-muted">
          {thread.others[0]?.firstName ?? 'They'} won’t see your name.
        </p>
      )}

      {thread?.openAsks.map(ask => (
        <div key={ask.groupKey} className="flex items-center gap-3 rounded-xl bg-fill p-3">
          <p className="flex-1 text-subhead">{ask.label ? `Asked for ideas for ${ask.label}` : 'Asked for ideas'}</p>
          <MakeListButton search={makeListSearch(ask)} className="shrink-0" />
        </div>
      ))}

      <ol className="flex flex-col gap-2" aria-label="Messages">
        {thread?.messages.map(message => {
          if (message.kind === 'listMade') {
            return (
              <li key={message._id} className="my-2 text-center text-subhead text-ink-muted">
                {message.text}
              </li>
            );
          }
          const author = message.mine ? thread.me : thread.others.find(o => o.userId === message.authorId);
          return (
            <li
              key={message._id}
              className={cn('flex w-full items-end gap-2', message.mine ? 'justify-end' : 'justify-start')}
            >
              {!message.mine && <Avatar person={author} size={32} />}
              <div className="flex max-w-[75%] flex-col gap-1">
                {message.askLabel && (
                  <p className={cn('text-footnote text-ink-muted', message.mine && 'text-right')}>
                    Asked for ideas · {message.askLabel}
                  </p>
                )}
                {/* The corner nearest the avatar is tighter, pointing at who sent it. */}
                <p
                  className={cn(
                    'rounded-2xl px-3 py-2 whitespace-pre-line break-words',
                    message.mine
                      ? 'self-end rounded-br-md bg-accent text-accent-foreground'
                      : 'self-start rounded-bl-md bg-fill',
                  )}
                >
                  {message.text}
                </p>
              </div>
              {message.mine && <Avatar person={author} size={32} />}
            </li>
          );
        })}
      </ol>
      <div ref={bottom} />

      {/* The reply box sits at the bottom of the window, above the phone tab bar. */}
      {thread && (
        <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-background/95 backdrop-blur md:bottom-0">
          <div className="mx-auto max-w-2xl px-4 py-3">
            {thread.canSend ? (
              <form onSubmit={submit} className="flex items-center gap-2">
                <Input
                  className="flex-1 rounded-pill"
                  placeholder="Message"
                  aria-label="Message"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  autoFocus
                />
                <Button type="submit" size="icon" aria-label="Send" disabled={sending || !draft.trim()}>
                  <ArrowUp className="size-[18px]" />
                </Button>
              </form>
            ) : (
              <p className="text-center text-subhead text-ink-muted">{thread.cantSend}</p>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
