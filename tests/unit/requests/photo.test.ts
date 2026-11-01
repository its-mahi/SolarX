import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ApiError } from "@/lib/api/errors";
import { processRoofPhoto, sniffImageType } from "@/lib/requests/photo";
import { jpegWithGps, roofJpeg, roofPng, roofWebp, textAsJpeg, truncatedJpeg } from "../../helpers/images";

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP", async () => {
    expect(sniffImageType(await roofJpeg())).toBe("image/jpeg");
    expect(sniffImageType(await roofPng())).toBe("image/png");
    expect(sniffImageType(await roofWebp())).toBe("image/webp");
  });
  it("rejects text, GIF and PDF", () => {
    expect(sniffImageType(textAsJpeg())).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a....."))).toBeNull();
    expect(sniffImageType(Buffer.from("%PDF-1.7 ..."))).toBeNull();
  });
});

describe("processRoofPhoto", () => {
  it("strips EXIF/GPS and keeps the format", async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await processRoofPhoto(input, "image/jpeg");
    const meta = await sharp(out.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe("jpeg");
    expect(out.contentType).toBe("image/jpeg");
    expect(out.data.includes(Buffer.from("TestMake"))).toBe(false);
  });
  it("limits the longest side to 2048 px", async () => {
    const out = await processRoofPhoto(await roofPng(3000, 1500), "image/png");
    const meta = await sharp(out.data).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2048);
    expect(meta.format).toBe("png");
  });
  it("does not enlarge small images", async () => {
    const meta = await sharp((await processRoofPhoto(await roofWebp(), "image/webp")).data).metadata();
    expect(meta.width).toBe(1200);
  });
  it("rejects a truncated JPEG", async () => {
    await expect(processRoofPhoto(await truncatedJpeg(), "image/jpeg")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(processRoofPhoto(await truncatedJpeg(), "image/jpeg")).rejects.toBeInstanceOf(ApiError);
  });
});
