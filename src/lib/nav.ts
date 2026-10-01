import { BookOpen, Feather, Hourglass, Library, MessageCircle, ScanFace, Settings, Sparkles, type LucideIcon } from "lucide-react";

export interface Room {
  href: string;
  name: string;
  note: string;
  key: string;
  icon: LucideIcon;
  module?: string;
}

export const ROOMS: Room[] = [
  { href: "/", name: "Sanctuary", note: "Where you arrive", key: "s", icon: Sparkles },
  { href: "/talk", name: "Conversations", note: "Think out loud", key: "t", icon: MessageCircle, module: "talk" },
  { href: "/garden", name: "Memory Garden", note: "What you have kept", key: "g", icon: Library, module: "garden" },
  { href: "/reflect", name: "Reflection Room", note: "Write, quietly", key: "r", icon: Feather, module: "reflect" },
  { href: "/mirror", name: "The Mirror", note: "How you describe yourself", key: "m", icon: ScanFace, module: "mirror" },
  { href: "/capsules", name: "Time Capsules", note: "Letters to later", key: "c", icon: Hourglass, module: "capsules" },
  { href: "/memory", name: "Memory Ledger", note: "Everything the AI can see", key: "l", icon: BookOpen },
  { href: "/settings", name: "Settings", note: "Your space, your rules", key: ",", icon: Settings },
];
