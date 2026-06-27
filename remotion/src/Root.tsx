import { Composition } from "remotion";
import { MainVideo, TOTAL_FRAMES, FPS } from "./MainVideo";
import { MainVideoV2, TOTAL_FRAMES_V2, FPS_V2 } from "./MainVideoV2";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="main-v2"
      component={MainVideoV2}
      durationInFrames={TOTAL_FRAMES_V2}
      fps={FPS_V2}
      width={1920}
      height={1080}
    />
  </>
);
