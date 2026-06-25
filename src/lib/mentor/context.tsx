'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { MentorContext } from './ai';

/**
 * Lets the global Byte assistant (mounted once in AppChrome) pick up the live
 * context of whatever game screen is currently open, so on a Codecaster level
 * it can give a hint about the student's actual code, while on every other page
 * it's just the general "Ask Byte" chat.
 *
 * Two contexts on purpose: the `register` function is stable (so `useRegisterByte`
 * doesn't re-fire), the value updates when a screen registers/unregisters.
 */
export interface ByteRegistration {
  game: string;
  getContext: () => Partial<MentorContext>;
}

const ValueCtx = createContext<ByteRegistration | null>(null);
const RegisterCtx = createContext<(r: ByteRegistration | null) => void>(() => {});

export function MentorProvider({ children }: { children: ReactNode }) {
  const [registered, setRegistered] = useState<ByteRegistration | null>(null);
  return (
    <RegisterCtx.Provider value={setRegistered}>
      <ValueCtx.Provider value={registered}>{children}</ValueCtx.Provider>
    </RegisterCtx.Provider>
  );
}

/** Read by the global Byte: the current game context, or null on non-game pages. */
export function useByteContext(): ByteRegistration | null {
  return useContext(ValueCtx);
}

/**
 * Game screens call this to expose their live hint context to the global Byte.
 * Auto-unregisters on unmount. `getContext` may change every render (it closes
 * over live state) — we hold the latest in a ref so the effect stays stable.
 */
export function useRegisterByte(game: string, getContext?: () => Partial<MentorContext>) {
  const register = useContext(RegisterCtx);
  const getRef = useRef(getContext);
  getRef.current = getContext;
  useEffect(() => {
    register({ game, getContext: () => getRef.current?.() ?? {} });
    return () => register(null);
  }, [register, game]);
}
