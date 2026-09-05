import TiledGridLayout, { type TiledGridLayoutProps } from "./TiledGridLayout";
import SidebarLayout from "./SidebarLayout";

export default function AutoDynamicLayout(props: TiledGridLayoutProps) {
  const { tiles, pinnedKey } = props;
  // 1. If someone is sharing screen, automatically elevate to Sidebar/Stage layout
  const screenShareTile = tiles.find((t) => t.kind === "screen");
  if (screenShareTile) {
    return <SidebarLayout {...props} pinnedKey={pinnedKey || screenShareTile.key} />;
  }

  // 2. If a specific tile is pinned by user, show SidebarLayout
  if (pinnedKey && tiles.some((t) => t.key === pinnedKey)) {
    return <SidebarLayout {...props} />;
  }

  // 3. Otherwise, render the smart TiledGridLayout with dynamic bin packing
  return <TiledGridLayout {...props} />;
}
