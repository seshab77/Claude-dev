// ---------------------------------------------------------------------------
// Minimal IPv4 CIDR utilities. Enough to validate that subnets are inside
// their VPC's CIDR and don't overlap other subnets in the same VPC.
// ---------------------------------------------------------------------------

export interface CidrRange {
  network: number; // 32-bit unsigned int
  prefix: number;  // 0–32
  size: number;    // number of addresses in the block
}

const ipRe = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

export function parseCidr(cidr: string): CidrRange {
  const m = ipRe.exec(cidr.trim());
  if (!m) throw new Error(`invalid CIDR: ${cidr}`);
  const oct = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  for (const o of oct) {
    if (!Number.isInteger(o) || o < 0 || o > 255) {
      throw new Error(`invalid IP octet in CIDR: ${cidr}`);
    }
  }
  const prefix = Number(m[5]);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`invalid CIDR prefix: ${cidr}`);
  }
  // Convert to unsigned 32-bit integer using arithmetic (avoids the
  // signed-bitshift footgun for the top bit).
  const ipInt =
    oct[0] * 0x1000000 + oct[1] * 0x10000 + oct[2] * 0x100 + oct[3];
  const size = prefix === 0 ? 0x100000000 : 2 ** (32 - prefix);
  // Mask off host bits to produce the canonical network address.
  const network = prefix === 0 ? 0 : Math.floor(ipInt / size) * size;
  return { network, prefix, size };
}

/** Is `inner` fully contained within `outer`? */
export function cidrContains(outer: CidrRange, inner: CidrRange): boolean {
  if (inner.prefix < outer.prefix) return false;
  return inner.network >= outer.network &&
         inner.network + inner.size <= outer.network + outer.size;
}

/** Do two CIDR blocks overlap at all? */
export function cidrsOverlap(a: CidrRange, b: CidrRange): boolean {
  return a.network < b.network + b.size && b.network < a.network + a.size;
}
