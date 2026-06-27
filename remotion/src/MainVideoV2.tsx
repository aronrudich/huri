import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadDisplay } from "@remotion/google-fonts/SpaceGrotesk";
import { SCENES, COLORS } from "./themeV2";
import { Intro } from "./scenes/v2/Intro";
import { Messages } from "./scenes/v2/Messages";
import { CarTab } from "./scenes/v2/CarTab";
import { Blocking } from "./scenes/v2/Blocking";
import { Queue } from "./scenes/v2/Queue";
import { Buttons } from "./scenes/v2/Buttons";
import { SpotZero } from "./scenes/v2/SpotZero";
import { Lot } from "./scenes/v2/Lot";
import { Profile } from "./scenes/v2/Profile";
import { Problem } from "./scenes/v2/Problem";
import { Closing } from "./scenes/v2/Closing";

loadInter();
loadDisplay();

export const FPS_V2 = 30;
export const TOTAL_FRAMES_V2 =
  SCENES.intro + SCENES.messages + SCENES.carTab + SCENES.blocking + SCENES.queue +
  SCENES.buttons + SCENES.spotZero + SCENES.lot + SCENES.profile + SCENES.problem + SCENES.closing;

export const MainVideoV2: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.surface, fontFamily: "Inter" }}>
      <Audio src={staticFile("audio/vo-v2.mp3")} />
      <Series>
        <Series.Sequence durationInFrames={SCENES.intro}><Intro /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.messages}><Messages /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.carTab}><CarTab /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.blocking}><Blocking /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.queue}><Queue /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.buttons}><Buttons /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.spotZero}><SpotZero /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.lot}><Lot /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.profile}><Profile /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.problem}><Problem /></Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.closing}><Closing /></Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
