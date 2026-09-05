import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MobileAudioOutputSheet from "../MobileAudioOutputSheet";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { index?: number }) =>
      options?.index ? `${key}-${options.index}` : key,
  }),
}));

vi.mock("../../../../components/layout/BottomSheet", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));

const output = (deviceId: string, label: string) => ({
  deviceId,
  label,
  kind: "audiooutput",
  groupId: "",
  toJSON: () => ({}),
}) as MediaDeviceInfo;

describe("MobileAudioOutputSheet", () => {
  it("lists a connected headset and marks the selected output", () => {
    render(
      <MobileAudioOutputSheet
        open
        outputs={[output("speaker", "Phone speaker"), output("headset", "Bluetooth headphones")]}
        selectedDeviceId="headset"
        muted={false}
        canRoute
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        onMute={vi.fn()}
      />,
    );

    const headset = screen.getByRole("button", { name: /Bluetooth headphones/ });
    expect(headset).toContainElement(screen.getByLabelText("mobile.selectedOutput"));
  });

  it("selects mute and closes from cancel", () => {
    const onMute = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <MobileAudioOutputSheet
        open
        outputs={[]}
        selectedDeviceId="default"
        muted
        canRoute={false}
        onOpenChange={onOpenChange}
        onSelect={vi.fn()}
        onMute={onMute}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mobile.turnOffSound/ }));
    fireEvent.click(screen.getByRole("button", { name: /mobile.cancel/ }));
    expect(onMute).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
