"use client";

// A lightweight, dependency-free emoji picker (curated common set). Clicking an
// emoji calls onPick so the composer can insert it at the caret.
const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
  "😊", "🙂", "😉", "😍", "😘", "😜", "🤔", "😐",
  "😴", "😎", "🥳", "😢", "😭", "😤", "😡", "🥺",
  "😱", "🤯", "👍", "👎", "👌", "🙏", "👏", "🙌",
  "💪", "🤝", "✌️", "🤞", "👋", "✋", "❤️", "🧡",
  "💛", "💚", "💙", "💜", "🖤", "💔", "✨", "🔥",
  "⭐", "🎉", "✅", "❌", "⚠️", "💯", "📞", "📱",
  "💻", "📷", "📎", "🕐", "📍", "💰", "🎁", "☕",
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="grid max-h-44 w-60 grid-cols-8 gap-0.5 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-lg">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="grid h-7 w-7 place-items-center rounded text-lg hover:bg-canvas"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
