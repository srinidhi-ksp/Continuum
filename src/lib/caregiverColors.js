// "Woven Threads" is the whole visual identity of this app: every
// caregiver is a distinct, consistent color wherever they show up —
// avatars, timeline markers, activity entries, care-circle chips — so a
// glance at a color tells you who did what, without reading a name.
//
// The color is derived deterministically from the caregiver's id, so it
// never shifts between renders or reloads without needing to be stored
// anywhere.

export const THREAD_PALETTE = [
  { name: "plum", text: "#5B4B8A", bg: "#EFEAF9", line: "#8874C4" },
  { name: "terracotta", text: "#BE5B2E", bg: "#FBEAE0", line: "#D98455" },
  { name: "teal", text: "#3F7D6B", bg: "#E7F2ED", line: "#69A793" },
  { name: "gold", text: "#B4842A", bg: "#FBF1DE", line: "#D5A852" },
  { name: "rose", text: "#A24E63", bg: "#F8EAEE", line: "#C87C8E" },
  { name: "slate", text: "#4C6B8A", bg: "#E9EFF5", line: "#7B98B5" },
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // keep it a 32-bit int
  }
  return Math.abs(hash);
}

export function threadColorFor(id) {
  if (!id) return THREAD_PALETTE[0];
  return THREAD_PALETTE[hashString(String(id)) % THREAD_PALETTE.length];
}

export function initialFor(name) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}
