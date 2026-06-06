# Battle Learn Arena Smoke Checklist

Run this after changing Arena lobby, room service, match service, or engine networking.
Use Supabase env vars for real online testing; LocalTransport cross-tab is useful but
does not prove cross-device Realtime behavior.

## Setup

- Open 2-4 browsers or devices.
- Use distinct player names/avatars.
- Keep the in-match `NET` debug panel open on at least two clients.
- Confirm `Room`, `Match`, and `Seed` match across clients after start.

## Lobby

1. Create a custom room as host.
2. Join with 1-3 non-host clients.
3. Toggle ready and teams from every non-host.
4. Change map, difficulty, team size, weapon, and duration as host.
5. Confirm every client sees the same settings before start.

## Start

1. Start from host.
2. Confirm every client enters the game from the same countdown.
3. Repeat quick match with 3-4 non-host clients.
4. Confirm the elected host also enters the match.

## Match Sync

1. Move each human client and confirm remote positions update.
2. Shoot a human opponent and confirm HP drops on shooter and target screens.
3. Trigger Learning Pod, answer correctly, and confirm respawn appears everywhere.
4. Check scores update on every client.
5. Let the match end and compare results screens.

## Disconnects

1. Leave the lobby as host before start; non-host clients should return cleanly.
2. Reload one non-host during lobby countdown; remaining players should not stall.
3. Leave during match; stale movement should disappear or stop affecting play.
