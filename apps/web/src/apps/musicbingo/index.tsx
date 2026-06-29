import { LicenseGate } from "../../components/license-gate";
import { MusicBingoHost } from "./host";
import { MusicBingoPlayer } from "./player";
import { MusicBingoLogo } from "./logo";

export function MusicBingoWeb() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get("room");

  if (roomCode) {
    // Player mode does not require a license key.
    return <MusicBingoPlayer roomCode={roomCode} />;
  }

  return (
    <LicenseGate app="musicbingo" title="MusicBingo" logo={<MusicBingoLogo className="h-10 w-10" />}>
      <MusicBingoHost />
    </LicenseGate>
  );
}
