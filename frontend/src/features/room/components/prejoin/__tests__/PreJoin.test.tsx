import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PreJoinMeetingInfo from "../components/PreJoinMeetingInfo";
import PreJoinAudioTest from "../components/PreJoinAudioTest";
import PreJoinEffectsPicker from "../components/PreJoinEffectsPicker";
import type { RoomInfo } from "../../../schemas/room.schema";

describe("PreJoinMeetingInfo Component", () => {
  const mockRoomInfo: RoomInfo = {
    room_code: "XYZ123",
    name: "جلسه جبر خطی پیشرفته",
    status: "active",
    host: "Mohsen",
    participants: [
      {
        user__username: "student1",
        user__full_name: "سارا احمدی",
        role: "participant",
      },
    ],
    max_participants: 20,
    is_recorded: true,
  };

  it("renders room name, code, and participant info", () => {
    render(
      <PreJoinMeetingInfo
        roomName="جلسه جبر خطی پیشرفته"
        roomCode="XYZ123"
        roomInfo={mockRoomInfo}
        onJoin={vi.fn()}
        onPresent={vi.fn()}
        onCancel={vi.fn()}
        camEnabled={true}
        micEnabled={true}
      />
    );

    expect(screen.getByText("جلسه جبر خطی پیشرفته")).toBeInTheDocument();
    expect(screen.getByText("XYZ123")).toBeInTheDocument();
    expect(screen.getByText(/سارا احمدی/)).toBeInTheDocument();
    expect(screen.getByText("ضبط خودکار فعال است")).toBeInTheDocument();
  });

  it("calls onJoin and onPresent when buttons are clicked", () => {
    const handleJoin = vi.fn();
    const handlePresent = vi.fn();

    render(
      <PreJoinMeetingInfo
        roomName="کلاس فیزیک"
        roomCode="ABC789"
        roomInfo={null}
        onJoin={handleJoin}
        onPresent={handlePresent}
        onCancel={vi.fn()}
        camEnabled={true}
        micEnabled={false}
      />
    );

    const joinBtn = screen.getByRole("button", { name: /ورود به جلسه/i });
    fireEvent.click(joinBtn);
    expect(handleJoin).toHaveBeenCalledTimes(1);

    const presentBtn = screen.getByRole("button", { name: /اشتراک مستقیم صفحه/i });
    fireEvent.click(presentBtn);
    expect(handlePresent).toHaveBeenCalledTimes(1);
  });
});

describe("PreJoinAudioTest Component", () => {
  it("triggers onPlayTestSound when speaker test button is clicked", () => {
    const handlePlayTest = vi.fn();

    render(
      <PreJoinAudioTest
        micEnabled={true}
        audioLevel={40}
        audioBars={[10, 20, 30, 40]}
        onPlayTestSound={handlePlayTest}
        isPlayingTestSound={false}
      />
    );

    const playBtn = screen.getByRole("button", { name: /پخش صدای تست/i });
    fireEvent.click(playBtn);
    expect(handlePlayTest).toHaveBeenCalledTimes(1);
  });
});

describe("PreJoinEffectsPicker Component", () => {
  it("renders background options and handles change", () => {
    const handleChange = vi.fn();

    render(
      <PreJoinEffectsPicker
        selectedBg="none"
        onChangeBackground={handleChange}
        isLoading={false}
        isSupported={true}
      />
    );

    expect(screen.getByText("واقعی")).toBeInTheDocument();
    expect(screen.getByText("تاریک/بلور")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(6);

    fireEvent.click(buttons[1]); // Blur option
    expect(handleChange).toHaveBeenCalledWith("blur");
  });
});
