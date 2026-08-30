import { describe, expect, it } from "vitest";
import { classifyMp4Prefix } from "../progressiveCompatibility";

const box = (type: string, body: number[] = []) => {
  const bytes = new Uint8Array(8 + body.length);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  [...type].forEach((char, index) => { bytes[4 + index] = char.charCodeAt(0); });
  bytes.set(body, 8);
  return bytes;
};

const join = (...parts: Uint8Array[]) => {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => { bytes.set(part, offset); offset += part.length; });
  return bytes;
};

describe("classifyMp4Prefix", () => {
  it("accepts fast-start and fragmented prefixes", () => {
    expect(classifyMp4Prefix(join(box("ftyp"), box("moov")))).toEqual({
      eligible: true, code: "FASTSTART_MP4",
    });
    expect(classifyMp4Prefix(join(box("ftyp"), box("moof")))).toEqual({
      eligible: true, code: "FRAGMENTED_MP4",
    });
  });

  it("requires moov before mdat", () => {
    expect(classifyMp4Prefix(join(box("ftyp"), box("mdat")))).toEqual({
      eligible: false, code: "MP4_MOOV_AFTER_MDAT",
    });
    const largeMdatHeader = box("mdat");
    new DataView(largeMdatHeader.buffer).setUint32(0, 10_000_000);
    expect(classifyMp4Prefix(join(box("ftyp"), largeMdatHeader))).toEqual({
      eligible: false, code: "MP4_MOOV_AFTER_MDAT",
    });
  });
});
