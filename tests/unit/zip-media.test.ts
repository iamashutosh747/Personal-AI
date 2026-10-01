import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { crc32, zip } from "@/lib/zip";
import { baseMime, sniffMatches } from "@/lib/media";

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes an archive that standard tools can read back", () => {
    const files = [
      { name: "inner-world.json", data: new TextEncoder().encode('{"hello":"world"}') },
      { name: "media/ä-photo.bin", data: new Uint8Array([1, 2, 3, 250]) },
    ];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iw-zip-"));
    const file = path.join(dir, "out.zip");
    fs.writeFileSync(file, zip(files));
    const listing = execFileSync("python3", ["-c", `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print([ (i.filename,len(z.read(i))) for i in z.infolist()])`, file]).toString();
    expect(listing).toContain("('inner-world.json', 17)");
    expect(listing).toContain("('media/ä-photo.bin', 4)");
  });
});

describe("media sniffing", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
  const m4a = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]);

  it("accepts files whose bytes match their declared type", () => {
    expect(sniffMatches("image/png", png)).toBe(true);
    expect(sniffMatches("image/jpeg", jpg)).toBe(true);
    expect(sniffMatches("audio/webm", webm)).toBe(true);
    expect(sniffMatches("audio/mp4", m4a)).toBe(true);
  });

  it("rejects disguised or unknown files", () => {
    expect(sniffMatches("image/jpeg", png)).toBe(false);
    expect(sniffMatches("image/png", new TextEncoder().encode("<svg onload=alert(1)>"))).toBe(false);
    expect(sniffMatches("text/html", png)).toBe(false);
  });

  it("drops codec parameters from MIME types", () => {
    expect(baseMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseMime("Image/PNG")).toBe("image/png");
  });
});
