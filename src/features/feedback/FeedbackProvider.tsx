import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { FeedbackWindow } from './FeedbackWindow';

/** Что открыть: без полей — общий отзыв (кнопка в левой панели); `block` — блок панели (#74). */
export interface FeedbackRequest {
  block?: string;
}

interface Feedback {
  isOpen: boolean;
  open: (request?: FeedbackRequest) => void;
  close: () => void;
  toggle: () => void;
}

const FeedbackContext = createContext<Feedback | null>(null);

/** Одно окно обратной связи на приложение (ARCHITECTURE A16); открыть его можно из любого места. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<FeedbackRequest | null>(null);
  const open = useCallback((next: FeedbackRequest = {}) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);
  const toggle = useCallback(() => setRequest((r) => (r ? null : {})), []);
  const value = useMemo<Feedback>(
    () => ({ isOpen: request !== null, open, close, toggle }),
    [request, open, close, toggle],
  );
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {request && <FeedbackWindow block={request.block} onClose={close} />}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error('useFeedback: нет FeedbackProvider');
  return feedback;
}
