import { markImage } from "@/lib/icon";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (size === "maskable") return markImage(512, 0.28);
  return markImage(size === "192" ? 192 : 512);
}
