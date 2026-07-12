// Population Stability Index (PSI) drift detector. Builds a reference
// distribution from an initial calibration window, then continuously compares
// the live feature distribution against it. PSI > 0.2 is the industry rule of
// thumb for a meaningful population shift.

const BINS = [0, 0.5, 1, 1.5, 2, 3, 5, 9, Infinity]

export class DriftMonitor {
  private reference: number[] | null = null
  private calib: number[] = []
  private window: number[] = []
  private readonly calibTarget = 180
  private readonly windowSize = 150

  private hist(values: number[]): number[] {
    const counts = new Array(BINS.length - 1).fill(0)
    for (const v of values) {
      for (let i = 0; i < BINS.length - 1; i++) {
        if (v >= BINS[i] && v < BINS[i + 1]) { counts[i]++; break }
      }
    }
    const total = values.length || 1
    return counts.map((c) => Math.max(c / total, 1e-4))
  }

  /** Feed the drift-tracked signal (here: amount-to-median ratio). */
  observe(value: number): { psi: number; alert: boolean } {
    if (!this.reference) {
      this.calib.push(value)
      if (this.calib.length >= this.calibTarget) this.reference = this.hist(this.calib)
      return { psi: 0, alert: false }
    }
    this.window.push(value)
    if (this.window.length > this.windowSize) this.window.shift()
    if (this.window.length < 40) return { psi: 0, alert: false }

    const cur = this.hist(this.window)
    let psi = 0
    for (let i = 0; i < cur.length; i++) {
      psi += (cur[i] - this.reference[i]) * Math.log(cur[i] / this.reference[i])
    }
    psi = Math.max(0, Math.round(psi * 1000) / 1000)
    return { psi, alert: psi > 0.2 }
  }

  reset() {
    this.reference = null
    this.calib = []
    this.window = []
  }
}
