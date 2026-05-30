/**
 * Tiny helpers shared by the in-call panels for rendering participant /
 * chat-author avatars without each one importing the same constants.
 */

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_GRADIENTS = [
  "from-[#6366f1] to-[#38bdf8]",
  "from-[#22c55e] to-[#38bdf8]",
  "from-[#f59e0b] to-[#f87171]",
  "from-[#e879f9] to-[#6366f1]",
  "from-[#f59e0b] to-[#22c55e]",
  "from-[#38bdf8] to-[#6366f1]",
];

export function getAvatarGradient(identity: string): string {
  return AVATAR_GRADIENTS[identity.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

const NAME_COLORS = [
  "text-[#818cf8]",
  "text-[#38bdf8]",
  "text-[#f59e0b]",
  "text-[#22c55e]",
  "text-[#e879f9]",
  "text-[#f87171]",
];

/** Stable color for a chat author name based on their identity. */
export function getNameColor(identity: string): string {
  return NAME_COLORS[identity.charCodeAt(0) % NAME_COLORS.length];
}
