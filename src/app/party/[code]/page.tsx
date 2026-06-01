'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, getAvatar } from '@/store/useGame';
import { useParty } from '@/lib/party/useParty';
import { Confetti } from '@/components/ui/Confetti';

export default function PartyRoomPage() {
  return (
    <Suspense fallback={null}>
      <Room />
    </Suspense>
  );
}

function Room() {
  const params = useParams();
  const search = useSearchParams();
  const code = String(params.code ?? '').toUpperCase();
  const isHost = search.get('host') === '1';

  const playerName = useGame((s) => s.playerName);
  const avatarId = useGame((s) => s.avatarId);

  const party = useParty(code, { name: playerName || 'Player', avatar: getAvatar(avatarId).emoji, isHost });
  const { phase, players, question, qIndex, total, selected, startGame, answer, myId, questionMs } = party;

  return (
    <main id="main" className="min-h-screen dotted pb-8">
      <TopBar />
      <div className="mx-auto max-w-md px-4 py-5">
        {/* ── ERROR ── */}
        {phase === 'error' && (
          <div className="card text-center">
            <div className="text-4xl">📡</div>
            <p className="mt-2 font-display font-extrabold">Multiplayer is offline</p>
            <Link href="/map" className="btn-primary mt-4">Play solo</Link>
          </div>
        )}

        {/* ── CONNECTING ── */}
        {phase === 'connecting' && (
          <div className="grid min-h-[40vh] place-items-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-grape-100 border-t-grape" />
          </div>
        )}

        {/* ── LOBBY ── */}
        {phase === 'lobby' && (
          <div>
            <div className="card text-center">
              <p className="font-bold text-ink-soft">Room code — share it with friends!</p>
              <p className="my-2 font-display text-5xl font-extrabold tracking-widest text-grape">{code}</p>
              <p className="text-sm text-ink-faint">Players join at the 🎉 Party tab with this code.</p>
            </div>

            <PlayerList players={players} myId={myId} title={`Players (${players.length})`} />

            {isHost ? (
              <button onClick={startGame} disabled={players.length < 1} className="btn-primary mt-5 w-full text-lg disabled:opacity-40">
                ▶ Start battle!
              </button>
            ) : (
              <p className="mt-5 text-center font-bold text-ink-soft">⏳ Waiting for the host to start…</p>
            )}
            <Link href="/party" className="mt-3 block text-center text-sm font-bold text-ink-faint">← Leave room</Link>
          </div>
        )}

        {/* ── QUESTION / REVEAL ── */}
        {(phase === 'question' || phase === 'reveal') && question && (
          <div>
            <div className="flex items-center justify-between text-sm font-bold text-ink-soft">
              <span>Question {qIndex + 1}/{total}</span>
              <span>{players.length} players</span>
            </div>

            {/* timer */}
            {phase === 'question' && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-grape-100">
                <motion.div key={qIndex} initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: questionMs / 1000, ease: 'linear' }} className="h-full bg-gradient-to-r from-grape to-bubble" />
              </div>
            )}

            <div className="card mt-3 text-center">
              <div className="text-4xl">{question.emoji}</div>
              <p className="mt-2 font-display text-xl font-extrabold">{question.q}</p>
            </div>

            <div className="mt-4 grid gap-2">
              {question.options.map((opt, i) => {
                const isCorrect = i === question.answer;
                const isMine = i === selected;
                let cls = 'bg-white';
                if (phase === 'reveal') cls = isCorrect ? 'bg-mint/20 ring-2 ring-mint' : isMine ? 'bg-bubble/20 ring-2 ring-bubble' : 'bg-white opacity-60';
                else if (isMine) cls = 'bg-grape text-white';
                return (
                  <motion.button
                    key={i}
                    onClick={() => answer(i)}
                    whileTap={{ scale: 0.98 }}
                    disabled={phase === 'reveal' || selected !== null}
                    className={`rounded-2xl p-3 text-center font-display font-extrabold shadow-card ${cls}`}
                  >
                    {opt} {phase === 'reveal' && isCorrect && '✅'}
                  </motion.button>
                );
              })}
            </div>

            {phase === 'question' && selected !== null && <p className="mt-3 text-center text-sm font-bold text-mint-600">Locked in! Waiting for others…</p>}

            {phase === 'reveal' && <PlayerList players={players} myId={myId} title="Scoreboard" compact />}
          </div>
        )}

        {/* ── ENDED ── */}
        {phase === 'ended' && (
          <Results players={players} myId={myId} isHost={isHost} onPlayAgain={startGame} />
        )}
      </div>
    </main>
  );
}

function PlayerList({ players, myId, title, compact }: { players: { id: string; name: string; avatar: string; score: number; isHost: boolean }[]; myId: string; title: string; compact?: boolean }) {
  return (
    <section className={compact ? 'mt-4' : 'card mt-4'}>
      <p className="font-display font-extrabold">{title}</p>
      <ol className="mt-2 space-y-1.5">
        {players.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-3 rounded-2xl p-2 ${p.id === myId ? 'bg-grape-50 ring-2 ring-grape' : 'bg-cloud'}`}>
            <span className="w-5 text-center font-display font-extrabold text-ink-faint">{i + 1}</span>
            <span className="text-xl">{p.avatar}</span>
            <span className="flex-1 truncate font-bold">{p.name}{p.isHost && ' 👑'}{p.id === myId && ' (you)'}</span>
            <span className="font-display font-extrabold text-grape">{p.score}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Results({ players, myId, isHost, onPlayAgain }: { players: { id: string; name: string; avatar: string; score: number; isHost: boolean }[]; myId: string; isHost: boolean; onPlayAgain: () => void }) {
  const winner = players[0];
  const iWon = winner?.id === myId;
  return (
    <div className="relative">
      <Confetti />
      <div className="card text-center">
        <p className="font-display text-sm font-bold uppercase tracking-wide text-grape">Winner</p>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260 }} className="mt-2 text-6xl">
          {winner?.avatar ?? '🏆'}
        </motion.div>
        <p className="mt-2 font-display text-2xl font-extrabold">{winner?.name ?? 'Champion'} 🏆</p>
        <p className="text-ink-soft">{iWon ? 'That’s you — amazing! 🎉' : 'Great game, everyone!'}</p>
      </div>

      <AnimatePresence>
        <PlayerList players={players} myId={myId} title="Final scores" />
      </AnimatePresence>

      <div className="mt-5 flex gap-2">
        <Link href="/party" className="btn-ghost flex-1 text-center">🎉 New room</Link>
        {isHost && <button onClick={onPlayAgain} className="btn-primary flex-1">🔁 Play again</button>}
      </div>
    </div>
  );
}
