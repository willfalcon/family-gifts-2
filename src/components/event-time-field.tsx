import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function formatDisplay(value?: string) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// Accepts "17:30", "5:30pm", "5:30 PM", "5pm", "5" ... anything reasonably
// time-shaped. Returns 24h "HH:MM", or undefined if it can't be parsed.
function parseTimeInput(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
  if (!match) return undefined;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase().replace(/\./g, '');
  if (minute > 59) return undefined;

  if (meridiem) {
    if (hour < 1 || hour > 12) return undefined;
    if (meridiem === 'am') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23) {
    return undefined;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

interface Props {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  ariaLabel?: string;
}

// A time field that works two ways at once: click it (or tab into it) and a
// list of times drops down to pick from, like the date field's calendar; or
// just type a time directly ("5:30pm", "17:30", "5pm", ...) and tab/enter away.
export default function EventTimeField({ value, onChange, placeholder = 'Time', ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => formatDisplay(value));
  const selectedOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setText(formatDisplay(value));
  }, [value]);

  useEffect(() => {
    if (open) selectedOptionRef.current?.scrollIntoView({ block: 'center' });
  }, [open]);

  function commit(raw: string) {
    if (!raw.trim()) {
      onChange(undefined);
      setText('');
      return;
    }
    const parsed = parseTimeInput(raw);
    if (parsed) {
      onChange(parsed);
      setText(formatDisplay(parsed));
    } else {
      // Couldn't make sense of it - revert rather than saving garbage.
      setText(formatDisplay(value));
    }
  }

  function selectOption(option: string) {
    onChange(option);
    setText(formatDisplay(option));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Clock className="pointer-events-none absolute top-1/2 left-2.5 size-3.75 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={ariaLabel}
            value={text}
            placeholder={placeholder}
            className="pl-8"
            onChange={e => setText(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => commit(text)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit(text);
                setOpen(false);
              } else if (e.key === 'Escape') {
                setText(formatDisplay(value));
              }
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-40 p-1" align="start" onOpenAutoFocus={e => e.preventDefault()}>
        <div className="max-h-56 overflow-y-auto">
          {TIME_OPTIONS.map(option => (
            <button
              key={option}
              ref={option === value ? selectedOptionRef : undefined}
              type="button"
              onClick={() => selectOption(option)}
              className={cn(
                'block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                option === value && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
              )}
            >
              {formatDisplay(option)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
