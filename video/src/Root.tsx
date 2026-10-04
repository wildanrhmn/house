import { Composition, Still } from "remotion";
import { HouseDemo, TOTAL } from "./HouseDemo";
import { Card1, Card2, Card3, Card4 } from "./cards/Cards";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HouseDemo" component={HouseDemo} durationInFrames={TOTAL} fps={60} width={1920} height={1080} />
    <Still id="Card1" component={Card1} width={1920} height={1080} />
    <Still id="Card2" component={Card2} width={1920} height={1080} />
    <Still id="Card3" component={Card3} width={1920} height={1080} />
    <Still id="Card4" component={Card4} width={1920} height={1080} />
  </>
);
