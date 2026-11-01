import { describe, expect, it } from "vitest";
import { detectFileType } from "@/lib/validation/file-signature";

const b = (...n: number[]) => new Uint8Array(n);

describe("detectFileType", () => {
  it("detects JPEG, PNG, PDF from bytes", () => {
    expect(detectFileType(b(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectFileType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectFileType(new TextEncoder().encode("%PDF-1.4\n"))).toBe("application/pdf");
  });
  it("detects WebP (009's allow-list rejects it in the route)", () => {
    expect(detectFileType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("returns null for executables, text renamed .pdf and empty input", () => {
    expect(detectFileType(new TextEncoder().encode("MZ\x90\x00 not a pdf"))).toBeNull();
    expect(detectFileType(new TextEncoder().encode("hello world"))).toBeNull();
    expect(detectFileType(new Uint8Array())).toBeNull();
  });
});
