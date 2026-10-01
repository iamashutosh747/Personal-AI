export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MEDIA: Record<string, { kind: "image" | "audio"; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "image", ext: "gif" },
  "image/heic": { kind: "image", ext: "heic" },
  "image/heif": { kind: "image", ext: "heif" },
  "audio/webm": { kind: "audio", ext: "webm" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
  "audio/x-m4a": { kind: "audio", ext: "m4a" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/wav": { kind: "audio", ext: "wav" },
};

/** "audio/webm;codecs=opus" -> "audio/webm" */
export function baseMime(type: string) {
  return type.split(";")[0]!.trim().toLowerCase();
}

// Magic numbers for the formats we accept, so a renamed file can't pose as an image.
export function sniffMatches(mime: string, head: Uint8Array): boolean {
  const at = (i: number, ...bytes: number[]) => bytes.every((b, j) => head[i + j] === b);
  const ascii = (i: number, s: string) => at(i, ...[...s].map((c) => c.charCodeAt(0)));
  switch (mime) {
    case "image/jpeg":
      return at(0, 0xff, 0xd8, 0xff);
    case "image/png":
      return at(0, 0x89, 0x50, 0x4e, 0x47);
    case "image/gif":
      return ascii(0, "GIF8");
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "image/heic":
    case "image/heif":
    case "audio/mp4":
    case "audio/x-m4a":
      return ascii(4, "ftyp");
    case "audio/webm":
      return at(0, 0x1a, 0x45, 0xdf, 0xa3);
    case "audio/ogg":
      return ascii(0, "OggS");
    case "audio/wav":
      return ascii(0, "RIFF") && ascii(8, "WAVE");
    case "audio/mpeg":
      return ascii(0, "ID3") || (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0);
    case "audio/aac":
      return head[0] === 0xff && ((head[1] ?? 0) & 0xf0) === 0xf0;
    default:
      return false;
  }
}
