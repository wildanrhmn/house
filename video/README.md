# HOUSE video

A 72 second explainer made with Remotion, voiced with ElevenLabs.

```
npm install
npm run dev      # Remotion Studio
npm run render   # out/house.mp4
```

Voiceover lines live in `generate-vo.mjs`. To regenerate, set the key in the environment for that one command, never in a file:

```
$env:XI="<elevenlabs key>"; node generate-vo.mjs
```

The desk screenshots in `public/img` come from a real quote, take and cash out on Somnia testnet.
