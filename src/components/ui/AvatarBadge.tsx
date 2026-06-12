'use client';

import { resolveAvatar } from '@/data/cosmetics';

/**
 * One avatar tile everywhere — renders the pixel-art portrait when the avatar
 * has one, else the emoji glyph, inside the same rounded badge so mixed lists
 * (pixel + classic emoji avatars, or unknown wire strings) stay visually even.
 *
 * `avatar` accepts an avatar id ('robot') or the wire emoji ('🤖') — lobby
 * lists receive emojis over presence, local surfaces pass the store id.
 * Size the badge via `className` (h-/w- + text- for the emoji fallback).
 */
export function AvatarBadge({
  avatar,
  className = 'h-10 w-10 text-2xl',
  rounded = 'rounded-xl',
  bg = 'bg-grape-50',
  alt,
}: {
  avatar: string;
  className?: string;
  rounded?: string;
  /** '' to inherit the parent tile's background (e.g. selected state). */
  bg?: string;
  alt?: string;
}) {
  const def = resolveAvatar(avatar);
  if (def?.img) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local static SVG, no optimizer needed
      <img
        src={def.img}
        alt={alt ?? def.name}
        draggable={false}
        className={`${className} ${rounded} ${bg} select-none object-contain p-1`}
      />
    );
  }
  return (
    <span
      aria-label={alt ?? def?.name}
      className={`${className} ${rounded} ${bg} grid select-none place-items-center leading-none`}
    >
      {def?.emoji ?? avatar}
    </span>
  );
}
