import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RoomMobileControls from "../RoomMobileControls";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../hooks/useRoomWhiteboard", () => ({ useRoomWhiteboard: () => ({ whiteboard: { isActive: false } }) }));
vi.mock("../ChatUnreadBadge", () => ({ default: () => null }));
vi.mock("../InviteModal", () => ({ default: () => null }));
vi.mock("../../../recordings/hooks/useRoomRecording", () => ({ useRoomRecording: () => ({ canControl: false }) }));
const props = { isMicOn: true, isCamOn: true, isScreenSharing: false, settingsOpen: false, activePanel: null, handRaised: false, onToggleMic: vi.fn(), onToggleCam: vi.fn(), onToggleScreenShare: vi.fn(), onToggleSettings: vi.fn(), onLeave: vi.fn(), onPanelClick: vi.fn(), onToggleHandRaise: vi.fn() };
describe("mobile reference controls", () => {
 it("keeps camera, microphone, hand, more and leave in that order", () => {
  render(<RoomMobileControls {...props}/>);
  expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["tooltips.cameraOn", "tooltips.muteOn", "controls.raiseHand", "controls.more", "tooltips.leave"]);
 });
 it("opens all secondary controls and toggles closed on the second click", () => {
  render(<RoomMobileControls {...props}/>);
  const more = screen.getByRole("button", { name: "controls.more" });
  fireEvent.click(more);
  for (const name of ["controls.chat", "controls.people", "controls.tools", "mobile.invite", "controls.reactions", "controls.settings"]) expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
  fireEvent.click(more);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  fireEvent.click(more); fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
 });
});
