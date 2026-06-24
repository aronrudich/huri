import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadDisplay } from "@remotion/google-fonts/SpaceGrotesk";
import { SCENES, COLORS } from "./theme";
import { Intro } from "./scenes/Intro";
import { Messages } from "./scenes/Messages";
import { Park } from "./scenes/Park";
import { Pickup } from "./scenes/Pickup";
import { Queue } from "./scenes/Queue";
import { Outro } from "./scenes/Outro";

loadInter();
loadDisplay();

export const FPS = 30;
export const TOTAL_FRAMES =
  SCENES.intro + SCENES.messages + SCENES.park + SCENES.pickup + SCENES.queue + SCENES.outro;

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.surface, fontFamily: "Inter" }}>
      <Audio src={staticFile("audio/vo.mp3")} />
      <Series>
        <Series.Sequence durationInFrames={SCENES.intro}><Intro /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.messages}><Messages /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.park}><Park /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.pickup}><Pickup /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.queue}><Queue /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.outro}><Outro /></Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
