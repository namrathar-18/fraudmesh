import { Rng } from './rng'
import type { Channel, FraudScenario, Transaction } from './types'

const BANKS = ['okhdfc', 'oksbi', 'okicici', 'okaxis', 'paytm', 'ybl', 'ibl']

// Indian metros with approximate coordinates for the geographic module.
interface City { name: string; lat: number; lng: number }
const CITIES: City[] = [
  { name: 'Mumbai', lat: 19.076, lng: 72.877 },
  { name: 'Delhi', lat: 28.704, lng: 77.102 },
  { name: 'Bengaluru', lat: 12.972, lng: 77.594 },
  { name: 'Hyderabad', lat: 17.385, lng: 78.487 },
  { name: 'Chennai', lat: 13.083, lng: 80.271 },
  { name: 'Kolkata', lat: 22.573, lng: 88.364 },
  { name: 'Pune', lat: 18.520, lng: 73.857 },
  { name: 'Ahmedabad', lat: 23.023, lng: 72.571 },
  { name: 'Jaipur', lat: 26.912, lng: 75.787 },
  { name: 'Lucknow', lat: 26.847, lng: 80.947 },
]
// Mule rings tend to concentrate geographically — a "fraud hotspot".
const HOTSPOT: City = { name: 'Jamtara', lat: 23.960, lng: 86.803 }
const FIRST = ['aarav', 'diya', 'kabir', 'anaya', 'vivaan', 'myra', 'reyansh', 'aisha', 'arjun', 'sara', 'ishaan', 'kiara', 'rohan', 'nisha', 'dev', 'tara']
const CHANNELS: Channel[] = ['P2P', 'P2M', 'BILL', 'RECHARGE']
const MERCHANTS = ['bigbasket', 'zomato', 'irctc', 'jiorecharge', 'flipkart', 'swiggy', 'myntra']

let seq = 0
const nextId = (p: string) => `${p}_${(++seq).toString(36)}_${Date.now().toString(36).slice(-4)}`

export interface Account {
  vpa: string
  medianAmount: number
  createdAt: number
  device: string
  isMule: boolean
  city: City
}

/**
 * Streaming transaction generator. Emits mostly-legitimate UPI-like traffic
 * with a configurable rate of injected fraud. Can shift tactics mid-run to
 * exercise the drift detector.
 */
export class Simulator {
  private rng: Rng
  accounts: Account[] = []
  private muleRing: Account[] = []
  private startedAt: number
  /** When true, fraud amounts/patterns change — used to trigger concept drift. */
  tacticsShifted = false

  constructor(seed = 42) {
    this.rng = new Rng(seed)
    this.startedAt = Date.now()
    this.bootstrapAccounts()
  }

  private bootstrapAccounts() {
    // Large legit population so per-account velocity stays realistic (real UPI
    // has millions of accounts; a tiny pool would make every account look busy).
    for (let i = 0; i < 800; i++) this.accounts.push(this.newAccount(false))
    // A mule ring: several accounts that funnel money to one collector.
    for (let i = 0; i < 7; i++) {
      const m = this.newAccount(true)
      this.muleRing.push(m)
      this.accounts.push(m)
    }
  }

  private newAccount(isMule: boolean): Account {
    const vpa = `${this.rng.pick(FIRST)}${this.rng.int(10, 998)}@${this.rng.pick(BANKS)}`
    return {
      vpa,
      medianAmount: isMule ? this.rng.int(200, 600) : this.rng.int(150, 4000),
      createdAt: this.startedAt - this.rng.int(1, 900) * 86400000,
      device: `dev_${this.rng.int(1000, 9999).toString(16)}`,
      isMule,
      // Mules cluster in the fraud hotspot; legit users spread across metros.
      city: isMule ? HOTSPOT : this.rng.pick(CITIES),
    }
  }

  shiftTactics() {
    this.tacticsShifted = true
    // Fraudsters change behaviour: introduce a fresh cluster of burner devices
    // and lower amounts to slip under naive thresholds.
    for (const m of this.muleRing) m.device = `burner_${this.rng.int(1000, 9999).toString(16)}`
  }

  reset() {
    this.tacticsShifted = false
    this.accounts = []
    this.muleRing = []
    this.startedAt = Date.now()
    this.bootstrapAccounts()
  }

  private mk(
    payer: Account,
    payee: string,
    amount: number,
    channel: Channel,
    truth: FraudScenario,
    deviceOverride?: string,
  ): Transaction {
    const jitter = () => (this.rng.next() - 0.5) * 0.5
    return {
      txnId: nextId('txn'),
      ts: Date.now(),
      payer: payer.vpa,
      payee,
      amount: Math.max(1, Math.round(amount)),
      deviceId: deviceOverride ?? payer.device,
      ip: `${this.rng.int(10, 223)}.${this.rng.int(0, 255)}.${this.rng.int(0, 255)}.${this.rng.int(1, 254)}`,
      channel,
      city: payer.city.name,
      lat: payer.city.lat + jitter(),
      lng: payer.city.lng + jitter(),
      truth,
    }
  }

  /** Produce the next transaction. ~4% of traffic is fraudulent. */
  emit(): Transaction {
    const roll = this.rng.next()
    if (roll < 0.018) return this.muleTxn()
    if (roll < 0.030) return this.takeoverTxn()
    if (roll < 0.040) return this.launderingTxn()
    return this.legitTxn()
  }

  private legitTxn(): Transaction {
    const payer = this.rng.pick(this.accounts.filter((a) => !a.isMule))
    const channel = this.rng.pick(CHANNELS)
    let payee: string
    if (channel === 'P2M' || channel === 'BILL' || channel === 'RECHARGE') {
      payee = `${this.rng.pick(MERCHANTS)}@${this.rng.pick(BANKS)}`
    } else {
      payee = this.rng.pick(this.accounts).vpa
    }
    const amount = Math.abs(this.rng.normal(payer.medianAmount, payer.medianAmount * 0.4))
    return this.mk(payer, payee, amount, channel, 'none')
  }

  // Mule network: ring members fan money into a single collector account.
  private muleTxn(): Transaction {
    const collector = this.muleRing[0]
    const sender = this.rng.pick(this.muleRing.slice(1))
    const base = this.tacticsShifted ? this.rng.int(80, 240) : this.rng.int(300, 900)
    return this.mk(sender, collector.vpa, base, 'P2P', 'mule_network')
  }

  // Account takeover: a legit account suddenly transacts from a brand-new device,
  // at night, for ~9x its usual amount, to an unfamiliar payee.
  private takeoverTxn(): Transaction {
    const victim = this.rng.pick(this.accounts.filter((a) => !a.isMule))
    const amount = victim.medianAmount * (this.tacticsShifted ? 4 : 9)
    const burner = `burner_${this.rng.int(1000, 9999).toString(16)}`
    const payee = this.rng.pick(this.muleRing).vpa
    return this.mk(victim, payee, amount, 'P2P', 'account_takeover', burner)
  }

  // Laundering chain: rapid pass-through hops between mule accounts.
  private launderingTxn(): Transaction {
    const i = this.rng.int(0, this.muleRing.length - 2)
    const from = this.muleRing[i]
    const to = this.muleRing[i + 1]
    const amount = this.rng.int(1500, 6000)
    return this.mk(from, to.vpa, amount, 'P2P', 'laundering_chain')
  }
}
