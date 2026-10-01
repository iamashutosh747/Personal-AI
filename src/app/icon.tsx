import { markImage } from "@/lib/icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return markImage(64, 0.08);
}
