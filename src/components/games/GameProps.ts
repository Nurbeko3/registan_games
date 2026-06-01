/** Contract every mini-game implements. Kept in its own module so games never
 *  need to import GameShell (avoids a circular dependency). */
export interface GameProps {
  /** Call when the player wins, passing 1–3 stars based on performance. */
  onWin: (stars: number) => void;
}
