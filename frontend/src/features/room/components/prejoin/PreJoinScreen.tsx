import { useState } from "react";
import { usePreJoinTrack } from "../../hooks/usePreJoinTrack";
import { usePreJoinMedia } from "../../hooks/usePreJoinMedia";
import { usePreJoinRoomInfo } from "../../hooks/usePreJoinRoomInfo";
import { type BackgroundType } from "../../hooks/useBackgroundBlur";
import PreJoinPreview from "./components/PreJoinPreview";
import PreJoinMeetingInfo from "./components/PreJoinMeetingInfo";
import PreJoinDeviceSettings from "./components/PreJoinDeviceSettings";
import { useAuthStore } from "../../../auth/store/authStore";

export interface PreJoinSettings {
  micEnabled: boolean;
  camEnabled: boolean;
  selectedMic: string;
  selectedCam: string;
  selectedSpeaker: string;
  background: BackgroundType;
  guestName?: string;
}

export interface PreJoinScreenProps {
  roomName?: string;
  roomCode: string;
  onJoin: (settings: PreJoinSettings) => void;
  onCancel: () => void;
}

export default function PreJoinScreen({
  roomCode,
  onJoin,
  onCancel,
}: PreJoinScreenProps) {
  // Local state
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Auth state — determines whether we join as authenticated user or guest
  const { user } = useAuthStore();
  const isAuthenticated = Boolean(user);

  // Guest display name: only pre-populate from localStorage for unauthenticated visitors.
  // Authenticated users MUST NOT inherit a stale guest name from a previous session.
  const [guestName, setGuestName] = useState(
    () => isAuthenticated ? "" : (localStorage.getItem("eduspace_guest_name") || ""),
  );

  // Hook 1: Media Devices & Audio Diagnostic
  const {
    microphones,
    cameras,
    speakers,
    selectedMic,
    selectedCam,
    selectedSpeaker,
    setSelectedMic,
    setSelectedCam,
    setSelectedSpeaker,
    isLoadingDevices,
    audioLevel,
    audioBars,
    playSpeakerTestSound,
    isPlayingTestSound,
  } = usePreJoinMedia(micEnabled);

  // Hook 2: LiveKit Video Track & Background Effects
  const {
    background: selectedBg,
    isLoading: bgLoading,
    isSupported: bgSupported,
    attachToVideo,
    changeBackground,
    stopTrack,
    cameraError,
  } = usePreJoinTrack(camEnabled, selectedCam);

  // Hook 3: Room Info & Participants
  const { roomInfo } = usePreJoinRoomInfo(roomCode);

  // Handlers
  const handleJoinNow = async () => {
    await stopTrack();
    // Only persist and pass guestName for unauthenticated users.
    // Authenticated users always join via the authenticated API endpoint;
    // passing a guestName would cause joinRoomGuest() to be called instead.
    if (!isAuthenticated && guestName.trim()) {
      localStorage.setItem("eduspace_guest_name", guestName.trim());
    }
    onJoin({
      micEnabled,
      camEnabled,
      selectedMic,
      selectedCam,
      selectedSpeaker,
      background: selectedBg,
      // Do NOT pass guestName for authenticated users
      guestName: isAuthenticated ? undefined : guestName.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-[var(--s0)] text-[var(--t1)] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left / Top Hero Preview Stage (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <PreJoinPreview
              videoRefCallback={attachToVideo}
              camEnabled={camEnabled}
              micEnabled={micEnabled}
              cameraError={cameraError}
              onToggleCam={() => setCamEnabled((prev) => !prev)}
              onToggleMic={() => setMicEnabled((prev) => !prev)}
              isMirrored={isMirrored}
              onToggleMirror={() => setIsMirrored((prev) => !prev)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              selectedBg={selectedBg}
              onChangeBackground={changeBackground}
              bgLoading={bgLoading}
              bgSupported={bgSupported}
              isLoadingDevices={isLoadingDevices}
              audioLevel={audioLevel}
              audioBars={audioBars}
              guestName={guestName}
            />
          </div>

          {/* Right / Bottom Meeting Intelligence & CTAs (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <PreJoinMeetingInfo
              roomCode={roomCode}
              roomInfo={roomInfo}
              onJoin={handleJoinNow}
              onCancel={onCancel}
              camEnabled={camEnabled}
              micEnabled={micEnabled}
              guestName={guestName}
              onGuestNameChange={setGuestName}
            />
          </div>
        </div>
      </div>

      {/* Deep Device & Effects Settings Modal */}
      <PreJoinDeviceSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cameras={cameras}
        microphones={microphones}
        speakers={speakers}
        selectedCam={selectedCam}
        selectedMic={selectedMic}
        selectedSpeaker={selectedSpeaker}
        onSelectCam={setSelectedCam}
        onSelectMic={setSelectedMic}
        onSelectSpeaker={setSelectedSpeaker}
        camEnabled={camEnabled}
        micEnabled={micEnabled}
        isMirrored={isMirrored}
        onToggleMirror={() => setIsMirrored((prev) => !prev)}
        audioLevel={audioLevel}
        audioBars={audioBars}
        onPlayTestSound={playSpeakerTestSound}
        isPlayingTestSound={isPlayingTestSound}
        selectedBg={selectedBg}
        onChangeBackground={changeBackground}
        bgLoading={bgLoading}
        bgSupported={bgSupported}
      />
    </div>
  );
}
