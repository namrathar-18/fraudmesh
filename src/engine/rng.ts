// Small deterministic PRNG (mulberry32) so demos are reproducible and
// so we never pull in a dependency just for random numbers.

export class Rng {
  private s: number
  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0
  }
  next(): number {
    this.s |= 0
    this.s = (this.s + 0x6d2b79f5) | 0
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)]
  }
  bool(p: number): boolean {
    return this.next() < p
  }
  // Box–Muller normal
  normal(mean = 0, sd = 1): number {
    const u = Math.max(1e-9, this.next())
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}
