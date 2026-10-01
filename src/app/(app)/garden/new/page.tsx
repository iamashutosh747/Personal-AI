import { requireViewer } from "@/lib/data";
import { Page, PageHeader } from "@/components/ui/Page";
import { MemoryForm } from "@/components/garden/MemoryForm";

export const metadata = { title: "A new memory" };

export default async function NewMemoryPage() {
  const { profile } = await requireViewer();
  return (
    <Page narrow>
      <PageHeader eyebrow="Memory Garden" title="Plant a memory" />
      <MemoryForm defaultAiAccess={profile.default_ai_access} />
    </Page>
  );
}
