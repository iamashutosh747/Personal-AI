import { ChatRoom } from "@/components/talk/ChatRoom";
import { aiConfigured } from "@/lib/ai/client";

export const metadata = { title: "Off the record" };

export default function OffRecordPage() {
  return (
    <ChatRoom
      conversation={null}
      offRecord
      initialMessages={[]}
      initialProposals={[]}
      initialLabels={{}}
      memoryOptions={[]}
      aiReady={aiConfigured()}
    />
  );
}
