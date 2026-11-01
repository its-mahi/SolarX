// Generated test images (sharp) for roof photo tests. Nothing here is a real photo.
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

function roofBase(width = 1200, height = 800) {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 110, b: 100 } } });
}

export const roofJpeg = (width = 1200, height = 800) => roofBase(width, height).jpeg({ quality: 80 }).toBuffer();
export const roofPng = (width = 1200, height = 800) => roofBase(width, height).png().toBuffer();
export const roofWebp = (width = 1200, height = 800) => roofBase(width, height).webp().toBuffer();

/** JPEG carrying GPS and device EXIF that must be stripped. */
export function jpegWithGps(): Promise<Buffer> {
  return roofBase()
    .withExif({
      IFD0: { Make: "TestMake", Model: "TestModel" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "17/1 24/1 45/1", GPSLongitudeRef: "E", GPSLongitude: "78/1 26/1 30/1" },
    })
    .jpeg()
    .toBuffer();
}

/** A valid JPEG larger than 5 MB (random noise). */
export async function oversizedJpeg(): Promise<Buffer> {
  const size = 2400;
  const raw = Buffer.alloc(size * size * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
}

export const textAsJpeg = () => Buffer.from("this is not an image, just text pretending to be a jpg");

/** JPEG header and some data but cut off before the end. */
export async function truncatedJpeg(): Promise<Buffer> {
  const full = await roofBase(800, 600).withMetadata().jpeg().toBuffer();
  return full.subarray(0, Math.floor(full.length / 3));
}

/** Writes a buffer to a temp file for Playwright file choosers; returns the path. */
export async function writeTempImage(buffer: Buffer, name = "roof.jpg"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "suryamit-img-"));
  const path = join(dir, name);
  await writeFile(path, buffer);
  return path;
}
