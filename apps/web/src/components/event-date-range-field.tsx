import { useId, useRef, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function parseISODate(value?: string) {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toISODate(date?: Date) {
  if (!date) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface Props {
  from?: string;
  to?: string;
  onChange: (from: string | undefined, to: string | undefined) => void;
}

// The "End date" switch controls which react-day-picker mode is mounted -
// `single` for a plain date, `range` (2 months, so a range can span a month
// boundary without extra clicks) once it's flipped on.
export default function EventDateRangeField({ from, to, onChange }: Props) {
  const switchId = useId();
  const switchWrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const fromDate = parseISODate(from);
  const toDate = parseISODate(to);
  const [rangeMode, setRangeMode] = useState(!!to);

  function handleRangeModeChange(checked: boolean) {
    setRangeMode(checked);
    if (!checked) {
      // Dropping back to a single date clears whatever end date existed.
      onChange(from, undefined);
    }
  }

  function handleSingleSelect(date: Date | undefined) {
    onChange(toISODate(date), undefined);
  }

  function handleRangeSelect(next: DateRange | undefined) {
    onChange(toISODate(next?.from), toISODate(next?.to));
  }

  const label = fromDate
    ? toDate && !isSameDay(toDate, fromDate)
      ? `${format(fromDate, 'MMM d, yyyy')} – ${format(toDate, 'MMM d, yyyy')}`
      : format(fromDate, 'MMM d, yyyy')
    : 'Pick a date';

  return (
    <div className="flex w-full items-center gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label="Event date"
            className={cn('flex-1 justify-start font-normal', !fromDate && 'text-muted-foreground')}
          >
            <CalendarIcon className="size-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          onInteractOutside={e => {
            // The "End date" switch lives outside the popover (it's visible
            // whether or not the calendar is open), so a click on it would
            // otherwise register as an outside click and close the calendar.
            if (switchWrapperRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
        >
          {rangeMode ? (
            <Calendar
              mode="range"
              selected={fromDate ? { from: fromDate, to: toDate } : undefined}
              onSelect={handleRangeSelect}
              defaultMonth={fromDate}
              numberOfMonths={2}
            />
          ) : (
            <Calendar mode="single" selected={fromDate} onSelect={handleSingleSelect} defaultMonth={fromDate} numberOfMonths={1} />
          )}
          {fromDate && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onChange(undefined, undefined);
                  setOpen(false);
                }}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <div ref={switchWrapperRef} className="flex shrink-0 items-center gap-2">
        <Switch id={switchId} size="sm" checked={rangeMode} onCheckedChange={handleRangeModeChange} />
        <Label htmlFor={switchId} className="text-sm font-normal text-muted-foreground">
          End date
        </Label>
      </div>
    </div>
  );
}
