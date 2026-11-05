import { useSyncExternalStore } from 'react';
import { AlertDialog } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/utils';

// The web version of mobile's Alert.alert: one dialog at a time, opened from
// anywhere (no hook needed), resolving with the button that was pressed.
//
//   if (await confirm({ title: 'Delete?', confirmText: 'Delete', destructive: true })) ...
//   showAlert('Couldn’t update event', message)

interface AlertRequest {
  title: string;
  message?: string;
  // Leave out for a plain alert with just OK.
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

let current: AlertRequest | null = null;
const listeners = new Set<() => void>();

function set(next: AlertRequest | null) {
  current = next;
  listeners.forEach(l => l());
}

export function confirm(options: Omit<AlertRequest, 'resolve'>): Promise<boolean> {
  current?.resolve(false);
  return new Promise(resolve => set({ ...options, resolve }));
}

export function showAlert(title: string, message?: string) {
  return confirm({ title, message });
}

// Shows a failed mutation's message under `title`.
export function showError(title: string, e: unknown) {
  return showAlert(title, errorMessage(e));
}

function answer(ok: boolean) {
  const request = current;
  set(null);
  request?.resolve(ok);
}

export function AlertHost() {
  const request = useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );

  return (
    <AlertDialog.Root open={!!request} onOpenChange={open => !open && answer(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-scrim/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl bg-card p-6 shadow-glass outline-none">
          <div className="flex flex-col gap-2 text-center">
            <AlertDialog.Title className="text-lg font-bold text-ink">{request?.title}</AlertDialog.Title>
            <AlertDialog.Description className={request?.message ? 'text-[15px] text-ink' : 'sr-only'}>
              {request?.message ?? request?.title}
            </AlertDialog.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            {request?.confirmText ? (
              <>
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary" className="sm:flex-1">
                    {request.cancelText ?? 'Cancel'}
                  </Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button
                    variant={request.destructive ? 'destructive' : 'default'}
                    className="sm:flex-1"
                    onClick={() => answer(true)}
                  >
                    {request.confirmText}
                  </Button>
                </AlertDialog.Action>
              </>
            ) : (
              <AlertDialog.Action asChild>
                <Button onClick={() => answer(true)}>OK</Button>
              </AlertDialog.Action>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
