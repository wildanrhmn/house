import { Composition } from "remotion";
import { HouseDemo, TOTAL } from "./HouseDemo";

export const RemotionRoot: React.FC = () => (
  <Composition id="HouseDemo" component={HouseDemo} durationInFrames={TOTAL} fps={60} width={1920} height={1080} />
);
