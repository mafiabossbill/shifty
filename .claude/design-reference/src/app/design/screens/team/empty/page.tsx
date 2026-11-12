import { GalleryShell } from "@/components/design/gallery-shell";
import { SAMPLE_MEMBERS } from "@/components/design/samples";
import { TeamSettings } from "@/components/team/team-settings";

export default function Page() {
  return (
    <GalleryShell pathname="/settings">
      <TeamSettings viewerId="sample-user" initialMembers={SAMPLE_MEMBERS.slice(0, 1)} initialInvites={[]} />
    </GalleryShell>
  );
}
