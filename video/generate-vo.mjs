// ElevenLabs voiceover, one MP3 per scene -> public/voiceover/N.mp3.
// Run:  $env:XI="<elevenlabs key>"; node generate-vo.mjs   (the key is never written to disk)
import { writeFileSync, mkdirSync } from "node:fs";

const XI = process.env.XI;
if (!XI) {
  console.error("Missing ElevenLabs key. Set XI in the environment first.");
  process.exit(1);
}
const VOICE = process.env.VOICE || "CwhRBWXzGAHq8TQ4Fs17";
const MODEL = "eleven_multilingual_v2";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

// Written for the ear: numbers and the domain spelled the way they should be said.
export const LINES = {
  1: "Every hour on DreamDEX, one question. Will Bitcoin be higher, or lower? And almost everyone does the same thing. They pick a side, and they hope.",
  2: "But DreamDEX has one rule most people miss. When one trader buys Up, and another buys Down, nobody has to sell. The pool mints a brand new pair. And one Up, plus one Down, always pays exactly one dollar.",
  3: "So what if you stopped picking sides? HOUSE lets any wallet sit on both. Post a price for Up, and a price for Down, that add up to less than a dollar. When takers cross both, you hold a full pair. Worth one dollar, whatever Bitcoin does.",
  4: "It is one button. HOUSE checks every order against the pool before you sign, so you never sign a trade that fails. Both sides taken. Cash out. The gap is yours.",
  5: "And it is live. On Somnia testnet, across all ten DreamDEX markets. Bots we had never met started taking HOUSE quotes on their own.",
  6: "DreamDEX order books are thin. Every HOUSE quote makes them deeper. HOUSE. Be the book. At bethebook dot x y z.",
};

mkdirSync("public/voiceover", { recursive: true });

for (const [id, text] of Object.entries(LINES)) {
  if (ONLY && !ONLY.includes(id)) continue;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: "POST",
    headers: { "xi-api-key": XI, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    }),
  });
  if (!r.ok) {
    console.error(`scene ${id} failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(`public/voiceover/${id}.mp3`, buf);
  console.log(`scene ${id}: ${buf.length} bytes`);
}
console.log("done");
