import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

  it("renders room code and other participant info", () => {
    render(
      <MemoryRouter>
        <PreJoinMeetingInfo
          roomCode="XYZ123"
          roomInfo={mockRoomInfo}
          onJoin={vi.fn()}
          onCancel={vi.fn()}
          camEnabled={true}
          micEnabled={true}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("XYZ123")).toBeInTheDocument();
    expect(screen.getByText(/سارا احمدی/)).toBeInTheDocument();
  });

  it("calls onJoin when join button is clicked", () => {
    const handleJoin = vi.fn();

    render(
      <MemoryRouter>
        <PreJoinMeetingInfo
          roomCode="ABC789"
          roomInfo={null}
          onJoin={handleJoin}
          onCancel={vi.fn()}
          camEnabled={true}
          micEnabled={false}
        />
      </MemoryRouter>
    );

    const joinBtn = screen.getByRole("button", { name: /ورود به جلسه|Join Now/i });
    fireEvent.click(joinBtn);
    expect(handleJoin).toHaveBeenCalledTimes(1);

    // Verify semantic back navigation link exists
    const backLink = screen.getByRole("link", { name: /انصراف|Cancel/i });
    expect(backLink).toBeInTheDocument();
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

    const playBtn = screen.getByRole("button", { name: /پخش صدای تست|Play Test/i });
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

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(6);

    fireEvent.click(buttons[1]); // Blur option
    expect(handleChange).toHaveBeenCalledWith("blur");
  });
});
