import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Background } from "./lib";
import { Hook } from "./scenes/Hook";
import { Rule } from "./scenes/Rule";
import { House } from "./scenes/House";
import { Desk } from "./scenes/Desk";
import { Proof } from "./scenes/Proof";
import { Outro } from "./scenes/Outro";

// Each scene is its narration clip plus a short lead-in and tail, at 60 fps.
// Clip lengths: 9.56, 14.11, 15.60, 10.40, 9.27, 8.62 seconds.
const T = 24;
export const D = { hook: 634, rule: 906, house: 996, desk: 684, proof: 616, outro: 620 };
export const TOTAL = D.hook + D.rule + D.house + D.desk + D.proof + D.outro - 5 * T;

const Scene: React.FC<{ children: React.ReactNode; vo: number }> = ({ children, vo }) => (
  <AbsoluteFill>
    {children}
    <Sequence from={20}>
      <Audio src={staticFile(`voiceover/${vo}.mp3`)} />
    </Sequence>
  </AbsoluteFill>
);

const cut = () => <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />;

export const HouseDemo: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={D.hook}>
        <Scene vo={1}>
          <Hook dur={D.hook} />
        </Scene>
      </TransitionSeries.Sequence>
      {cut()}
      <TransitionSeries.Sequence durationInFrames={D.rule}>
        <Scene vo={2}>
          <Rule dur={D.rule} />
        </Scene>
      </TransitionSeries.Sequence>
      {cut()}
      <TransitionSeries.Sequence durationInFrames={D.house}>
        <Scene vo={3}>
          <House dur={D.house} />
        </Scene>
      </TransitionSeries.Sequence>
      {cut()}
      <TransitionSeries.Sequence durationInFrames={D.desk}>
        <Scene vo={4}>
          <Desk dur={D.desk} />
        </Scene>
      </TransitionSeries.Sequence>
      {cut()}
      <TransitionSeries.Sequence durationInFrames={D.proof}>
        <Scene vo={5}>
          <Proof dur={D.proof} />
        </Scene>
      </TransitionSeries.Sequence>
      {cut()}
      <TransitionSeries.Sequence durationInFrames={D.outro}>
        <Scene vo={6}>
          <Outro dur={D.outro} />
        </Scene>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
