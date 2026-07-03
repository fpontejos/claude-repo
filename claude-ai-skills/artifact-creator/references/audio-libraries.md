# Audio Libraries

## Tone.js

> ⚠️ Use dynamic `import("tone")` — do NOT use static top-level import.
> `Tone.start()` MUST be called inside a user gesture handler (e.g. `onClick`).

```js
// Basic synth note
const Tone = await import("tone");
await Tone.start();
const synth = new Tone.Synth().toDestination();
synth.triggerAttackRelease("C4", "8n");

// Arpeggio
const synth = new Tone.Synth({ oscillator: { type: "triangle" } }).toDestination();
["C4","E4","G4","C5"].forEach((note, i) => {
  synth.triggerAttackRelease(note, "8n", Tone.now() + i * 0.25);
});

// Polyphonic synth (multiple simultaneous notes)
const poly = new Tone.PolySynth(Tone.Synth).toDestination();
poly.triggerAttackRelease(["C4","E4","G4"], "2n");

// Effects chain
const reverb = new Tone.Reverb({ decay: 2 }).toDestination();
const delay = new Tone.FeedbackDelay("8n", 0.5).connect(reverb);
const synth = new Tone.Synth().connect(delay);

// Sequencer
const seq = new Tone.Sequence((time, note) => {
  synth.triggerAttackRelease(note, "8n", time);
}, ["C4", "E4", "G4", "B4"], "4n");

const startSeq = async () => {
  await Tone.start();
  seq.start(0);
  Tone.Transport.start();
};
const stopSeq = () => {
  seq.stop();
  Tone.Transport.stop();
};

// Noise + filter
const noise = new Tone.Noise("white").start();
const filter = new Tone.Filter(400, "lowpass").toDestination();
noise.connect(filter);
```

```jsx
import { useState } from "react";

export default function SynthDemo() {
  const [playing, setPlaying] = useState(false);

  const play = async () => {
    const Tone = await import("tone");
    await Tone.start();
    setPlaying(true);
    const synth = new Tone.Synth({ oscillator: { type: "triangle" } }).toDestination();
    ["C4","E4","G4","C5"].forEach((note, i) =>
      synth.triggerAttackRelease(note, "8n", Tone.now() + i * 0.25)
    );
    setTimeout(() => setPlaying(false), 1200);
  };

  return (
    <button onClick={play} disabled={playing}>
      {playing ? "Playing…" : "Play arpeggio"}
    </button>
  );
}
```

### Oscillator types
`"sine"`, `"square"`, `"triangle"`, `"sawtooth"`, `"fmsine"`, `"amsine"`, `"pulse"`

### Available synths
`Synth`, `PolySynth`, `AMSynth`, `FMSynth`, `MetalSynth`, `MembraneSynth`, `PluckSynth`, `NoiseSynth`

### Available effects
`Reverb`, `FeedbackDelay`, `Chorus`, `Distortion`, `Phaser`, `Tremolo`, `Vibrato`, `BitCrusher`, `Filter`, `EQ3`, `Compressor`
