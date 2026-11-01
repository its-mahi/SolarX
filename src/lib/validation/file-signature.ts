// Magic-byte file type detection (shared by 008 and 009). Never trusts client-declared MIME.
export type DetectedFileType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  return bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);
}

export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}
