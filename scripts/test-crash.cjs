// Offline regression suite. Executes the real TS modules against a test-only
// clock and an in-memory transactional adapter. Never reads .env or connects
// to Telegram, a network endpoint, or the application database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
let now = 200_000_000
class TestDate extends Date { static now() { return now } }
function load(file, dependencies = {}) {
  const filename = path.join(root, file)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const exports = {}
  const context = {
    exports, module: { exports }, Buffer, Date: TestDate, console,
    process: { env: { SESSION_SECRET: 'offline-crash-regression-seed' } },
    require(name) { if (name in dependencies) return dependencies[name]; throw Error(`Unmocked dependency: ${name}`) },
  }
  vm.runInNewContext(output, context, { filename })
  return context.module.exports
}
const shared = load('lib/crash-shared.ts')
const server = load('lib/crash-server.ts', { 'server-only': {}, crypto, '@/lib/crash-shared': shared })
const { CrashClock } = load('lib/crash-clock.ts', { './crash-shared': shared })

function testClock() {
  const clock = new CrashClock()
  assert.equal(clock.phase(0), 'syncing')
  const sample = { serverTime: now + 6000, roundId: 10000, flightStart: now + 5000, nextRoundAt: now + 20000, phase: 'flying', multiplier: shared.multiplierAtElapsed(1000) }
  assert.equal(clock.accept(sample, 100, 200), true)
  assert.equal(clock.serverNow(200), sample.serverTime + 50)
  assert.equal(clock.phase(200), 'flying')
  let last = clock.multiplier(200)
  for (let mono = 201; mono < 2100; mono += 16) {
    if (mono === 841) clock.accept({ ...sample, serverTime: sample.serverTime + 570 }, 780, 841)
    const value = clock.multiplier(mono)
    assert.ok(value >= last, 'clock must not jump backwards after a delayed packet')
    last = value
  }
  assert.equal(clock.phase(10000), 'syncing')
  assert.equal(clock.multiplier(10000), clock.multiplier(20000), 'lost network must freeze projection')
  assert.equal(clock.accept({ ...sample, roundId: 9999 }, 3000, 3100), false)
  assert.equal(clock.accept(sample, 0, 4000), false, 'reject severely delayed clock sample')
  assert.equal(clock.crash(9999, 2), false)
  assert.equal(clock.crash(10000, 1.52), true)
  clock.accept({ ...sample, serverTime: sample.serverTime + 1000 }, 1200, 1300)
  assert.equal(clock.multiplier(1400), 1.52, 'late flying snapshot cannot resurrect crashed round')
  const next = { ...sample, roundId: 10001, flightStart: now + 25000, nextRoundAt: now + 40000, serverTime: now + 20020, phase: 'betting', multiplier: 1 }
  assert.equal(clock.accept(next, 15000, 15050), true)
  assert.equal(clock.phase(15050), 'betting')
  assert.equal(clock.multiplier(15050), 1)
  assert.equal(clock.phase(40000), 'syncing', 'cannot invent another round without a sample')
  console.log('PASS clock: RTT compensation, monotonic motion, stale freeze, old packets, crash signal, new round')
}

function testDistributionAndPrivacy() {
  const count = 100000
  const thresholds = [2, 5, 10, 20, 100]
  const totals = thresholds.map(() => 0)
  for (let i = 0; i < count; i++) {
    const point = server.crashPointForRound(i)
    assert.ok(point >= 1 && point <= 100)
    thresholds.forEach((value, index) => { if (point >= value) totals[index]++ })
  }
  thresholds.forEach((value, index) => {
    const observed = totals[index] / count
    const expected = .85 / value
    assert.ok(Math.abs(observed - expected) < .004, `distribution at ${value}x`)
  })
  const before = server.getPublicCrashClock(now + 1000)
  assert.equal(before.phase, 'betting')
  assert.equal(before.multiplier, 1)
  assert.equal('crashPoint' in before, false)
  assert.equal(before.recent[0].multiplier, server.crashPointForRound(before.roundId - 1))
  const after = server.getPublicCrashClock(now + 19999)
  assert.equal(after.phase, 'crashed')
  assert.equal(after.multiplier, server.crashPointForRound(after.roundId))
  console.log(`PASS seeded distribution (${count} rounds): ${thresholds.map((v, i) => `${v}x=${(totals[i] / count * 100).toFixed(2)}%`).join(', ')}`)
  console.log('PASS public clock: no future result, completed history only')
}

const table = name => new Proxy({ name }, { get: (target, key) => key in target ? target[key] : { table: name, key } })
const tables = Object.fromEntries(['users', 'gameHistory', 'inventory', 'gifts'].map(name => [name, table(name)]))
const read = (column, row) => column?.table ? row[column.table]?.[column.key] : column
const expr = {
  and: (...conditions) => row => conditions.every(fn => fn(row)),
  eq: (a, b) => row => read(a, row) === read(b, row),
  gte: (a, b) => row => read(a, row) >= read(b, row),
  inArray: (a, values) => row => values.includes(read(a, row)),
  desc: a => a,
  sql(parts, ...values) {
    const text = parts.join('?')
    if (text.includes(' >= ')) return row => Number(read(values[0], row)) >= Number(values[1])
    if (text.includes(' + ') || text.includes(' - ')) return row => Number(read(values[0], row)) + (text.includes(' - ') ? -1 : 1) * Number(values[1])
    return () => true
  },
}
let state, lockedReads, txActive = false, debitHook = null, authHook = null, queue = Promise.resolve()
function reset() {
  now = 200_000_000
  lockedReads = 0
  authHook = null
  state = {
    users: [{ id: 'test-user', balance: '1000' }], gameHistory: [],
    inventory: [{ id: 1, userId: 'test-user', giftId: 11, value: '100', source: 'case', status: 'owned' }],
    gifts: [{ id: 11, name: 'Test gift', value: '100', floorTon: '0', imageUrl: '/fixture.png', rarity: 'common' }, { id: 12, name: 'Test reward', value: '120', floorTon: '0', imageUrl: '/fixture2.png', rarity: 'rare' }],
  }
}
class Query {
  constructor(kind, target, fields) { this.kind = kind; this.target = target; this.fields = fields; this.predicate = () => true }
  from(target) { this.target = target; return this }
  where(predicate) { this.predicate = predicate; return this }
  innerJoin(target, predicate) { this.join = { target, predicate }; return this }
  orderBy() { return this }
  limit(limit) { this.maximum = limit; return this }
  for(mode) { assert.equal(mode, 'update'); assert.ok(txActive, 'locking outside transaction'); lockedReads++; return this }
  set(values) { this.values = values; return this }
  values(values) { this.insertValues = values; return this }
  returning(fields) { this.fields = fields; this.returns = true; return this }
  then(resolve, reject) { return Promise.resolve().then(() => this.run()).then(resolve, reject) }
  run() {
    const name = this.target.name
    let rows = state[name].map(row => ({ [name]: row }))
    if (this.join) rows = rows.flatMap(row => state[this.join.target.name].map(other => ({ ...row, [this.join.target.name]: other })).filter(this.join.predicate))
    rows = rows.filter(this.predicate)
    if (this.maximum !== undefined) rows = rows.slice(0, this.maximum)
    if (this.kind === 'update') {
      assert.ok(txActive, 'settlement writes must be transactional')
      rows.forEach(row => { for (const [key, value] of Object.entries(this.values)) row[name][key] = typeof value === 'function' ? String(value(row)) : value })
      if (name === 'users' && debitHook) { const hook = debitHook; debitHook = null; hook() }
    } else if (this.kind === 'insert') {
      assert.ok(txActive)
      const row = { id: state[name].length + 1, ...this.insertValues }
      state[name].push(row)
      rows = [{ [name]: row }]
    }
    if (this.kind !== 'select' && !this.returns) return undefined
    return rows.map(row => this.fields ? Object.fromEntries(Object.entries(this.fields).map(([key, column]) => [key, read(column, row)])) : { ...row[name] })
  }
}
const db = {
  select: fields => new Query('select', null, fields),
  update: target => new Query('update', target),
  insert: target => new Query('insert', target),
  transaction(work) {
    const result = queue.then(async () => {
      const before = structuredClone(state)
      txActive = true
      try { return await work(db) } catch (error) { state = before; throw error } finally { txActive = false }
    })
    queue = result.catch(() => undefined)
    return result
  },
}
const actions = load('app/actions/crash.ts', {
  crypto, 'drizzle-orm': expr, 'next/cache': { revalidatePath() {} }, 'next/server': { after() {} },
  '@/lib/db': { db }, '@/lib/db/schema': tables,
  '@/lib/session': { requireUserId: async () => { if (authHook) { const hook = authHook; authHook = null; hook() } return 'test-user' } }, '@/lib/crash-shared': shared,
  '@/lib/crash-server': { crashSecret: () => 'offline-action-test', crashPointForRound: () => 2.5, getPublicCrashClock: () => server.getPublicCrashClock(now) },
  '@/lib/pricing': { giftValueInStars: value => Number(value) },
  '@/lib/free-case-referrals': { assertFreeCaseGiftUnlocked() {}, getFreeCaseClaimStatus: async () => ({ ready: true }) },
  '@/lib/admin-notify': { notifyAdmins: async () => {} },
})

async function testSettlement() {
  reset()
  const round = await actions.startCrash(100)
  assert.equal(Number(state.users[0].balance), 900)
  await assert.rejects(() => actions.cashoutCrash(round.token), /ROUND_NOT_STARTED/)
  await assert.rejects(() => actions.settleCrashBust(round.token), /ROUND_NOT_FINISHED/)
  now += 6000
  const [first, retry] = await Promise.all([actions.cashoutCrash(round.token), actions.cashoutCrash(round.token)])
  assert.equal(first.success, true)
  assert.equal(JSON.stringify(first), JSON.stringify(retry))
  assert.equal(Number(state.users[0].balance), 900 + first.payout, 'one wager credits only once')
  assert.ok(lockedReads >= 2, 'settlement must lock history row')
  assert.equal('crashPoint' in first, false)
  assert.equal('crashPoint' in state.gameHistory[0].meta, false)
  now += 10000
  await actions.settleCrashBust(round.token)
  assert.equal(state.gameHistory[0].meta.status, 'cashed', 'late settlement cannot erase win')

  reset()
  debitHook = () => { now += 6000 }
  await assert.rejects(() => actions.startCrash(100), /BETTING_CLOSED/)
  assert.equal(Number(state.users[0].balance), 1000, 'late accepted debit must roll back')
  assert.equal(state.gameHistory.length, 0)
  console.log('PASS Stars settlement: preflight, row lock, one credit, retries, late settle, launch-boundary rollback')

  reset()
  const delayedAuth = await actions.startCrash(100)
  now += 6000
  authHook = () => { now += 10000 }
  const onTime = await actions.cashoutCrash(delayedAuth.token)
  assert.equal(onTime.success, true, 'DB/auth latency must not move a received cashout past crash')
  assert.equal(onTime.payout, 137.71)
  console.log('PASS cashout receipt timestamp is independent of slow authentication/database')

  reset()
  const giftRound = await actions.startGiftCrash([1])
  assert.equal(state.inventory[0].status, 'wagered')
  await assert.rejects(() => actions.cashoutGiftCrash(giftRound.token), /ROUND_NOT_STARTED/)
  now += 6000
  const results = await Promise.all([actions.cashoutGiftCrash(giftRound.token), actions.cashoutGiftCrash(giftRound.token)])
  assert.equal(JSON.stringify(results[0]), JSON.stringify(results[1]))
  assert.equal(results[0].gift.id, 1, 'reward ID is the owned inventory ID')
  assert.equal(results[0].gift.value, 120)
  assert.equal('crashPoint' in results[0], false)
  state.inventory[0].status = 'sold'
  await actions.cashoutGiftCrash(giftRound.token)
  assert.equal(state.inventory[0].status, 'sold', 'retry must not recreate sold gift')
  now += 10000
  await actions.settleGiftBust(giftRound.token)
  assert.equal(state.inventory[0].status, 'sold')
  assert.equal(state.gameHistory[0].meta.status, 'cashed')

  reset()
  const expensive = await actions.startGiftCrash([1])
  state.gifts.forEach(gift => { gift.value = '10000' })
  now += 6000
  await assert.rejects(() => actions.cashoutGiftCrash(expensive.token), /NO_AFFORDABLE_GIFT/)
  assert.equal(state.inventory[0].status, 'wagered')
  assert.equal(state.gameHistory[0].meta.status, 'active')
  console.log('PASS gift settlement: preflight, retries, inventory ownership, no resurrection, no over-priced fallback')
}

async function main() { testClock(); testDistributionAndPrivacy(); await testSettlement() }
main().catch(error => { console.error(error); process.exitCode = 1 })
