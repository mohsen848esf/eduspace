export type Mp4CompatibilityCode =
  | "FRAGMENTED_MP4"
  | "FASTSTART_MP4"
  | "MP4_MOOV_AFTER_MDAT"
  | "MP4_PREFIX_INCOMPLETE"
  | "INVALID_MP4_PREFIX";

export interface Mp4Compatibility {
  eligible: boolean;
  code: Mp4CompatibilityCode;
}

const boxType = (bytes: Uint8Array, offset: number) =>
  String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));

export const classifyMp4Prefix = (bytes: Uint8Array): Mp4Compatibility => {
  let offset = 0;
  let seenFtyp = false;
  while (offset + 8 <= bytes.length) {
    let size = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = boxType(bytes, offset);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > bytes.length) return { eligible: false, code: "MP4_PREFIX_INCOMPLETE" };
      const large = new DataView(bytes.buffer, bytes.byteOffset + offset + 8, 8).getBigUint64(0);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return { eligible: false, code: "INVALID_MP4_PREFIX" };
      size = Number(large);
      header = 16;
    } else if (size === 0) {
      size = bytes.length - offset;
    }
    if (size < header) return { eligible: false, code: "INVALID_MP4_PREFIX" };
    if (type === "ftyp") seenFtyp = true;
    else if (type === "moof" && seenFtyp) return { eligible: true, code: "FRAGMENTED_MP4" };
    else if (type === "moov" && seenFtyp) {
      if (offset + size > bytes.length) return { eligible: false, code: "MP4_PREFIX_INCOMPLETE" };
      return { eligible: true, code: "FASTSTART_MP4" };
    }
    else if (type === "mdat" && seenFtyp) return { eligible: false, code: "MP4_MOOV_AFTER_MDAT" };
    if (offset + size > bytes.length) return { eligible: false, code: "MP4_PREFIX_INCOMPLETE" };
    offset += size;
  }
  return {
    eligible: false,
    code: seenFtyp ? "MP4_PREFIX_INCOMPLETE" : "INVALID_MP4_PREFIX",
  };
};
