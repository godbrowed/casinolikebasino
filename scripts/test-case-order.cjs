// Offline regression suite: executes the actual TypeScript modules with
// in-memory catalog reads. No .env, database connection, or network access.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

function load(file, dependencies = {}) {
  const filename = path.join(root, file)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const exports = {}
  const context = {
    exports, module: { exports }, console, process: { env: {} },
    require(name) {
      if (name in dependencies) return dependencies[name]
      throw Error(`Unmocked dependency: ${name}`)
    },
  }
  vm.runInNewContext(output, context, { filename })
  return context.module.exports
}

const order = load('lib/case-order.ts')
const pricing = load('lib/pricing.ts')
const ids = cases => Array.from(cases, c => c.id)

function testComparator() {
  const input = [
    { id: 30, price: 1000, isFree: false },
    { id: 22, price: 100, isFree: false },
    { id: 20, price: 100, isFree: false },
    { id: 10, price: 9.5, isFree: false },
    { id: 99, price: 5000, isFree: true },
    { id: 8, price: 0, isFree: false },
  ]
  const snapshot = JSON.stringify(input)
  assert.deepEqual(ids([...input].sort(order.compareCasesByPrice)), [99, 8, 10, 20, 22, 30])
  assert.equal(JSON.stringify(input), snapshot, 'comparator must not change case data')
  assert.equal(order.compareCasesByPrice(input[0], input[0]), 0)
  assert.deepEqual(ids(input.slice(1, 3).reverse().sort(order.compareCasesByPrice)), [20, 22])
  console.log('PASS comparator: free first, numeric/decimal prices, stable ID ties, unchanged case data')
}

function caseRow(id, slug, price, isFree = false) {
  return { id, slug, name: slug, price: String(price), isFree, coverUrl: '/fixture.png', accent: '#fff', cooldownHours: isFree ? 24 : null }
}

// Intentionally arranged in legacy sortOrder, with stale stored prices whose
// order is opposite to the prices derived from the gifts below.
const caseRows = [
  caseRow(1, 'expensive-live', 1),
  caseRow(4, 'pug-club', 2),
  caseRow(3, 'pug-pocket', 3),
  caseRow(12, 'same-price-b', 4),
  caseRow(11, 'same-price-a', 5),
  caseRow(2, 'cheap-live', 9999),
  caseRow(8, 'legacy-fallback', 12),
  caseRow(99, 'free', 0, true),
]
const giftRows = [
  { caseId: 1, id: 101, value: '900', weight: '1' },
  { caseId: 2, id: 102, value: '12', weight: '1' },
  { caseId: 11, id: 111, value: '90', weight: '1' },
  { caseId: 12, id: 112, value: '90', weight: '1' },
  { caseId: 3, id: 103, value: '300', weight: '1' },
  { caseId: 4, id: 104, value: '300', weight: '1' },
].map(gift => ({ ...gift, slug: `gift-${gift.id}`, name: `Gift ${gift.id}`, rarity: 'common', imageUrl: '/gift.png', floorTon: null }))

const table = name => new Proxy({ name }, { get: (target, key) => key in target ? target[key] : { table: name, key } })
const tables = Object.fromEntries(['cases', 'caseItems', 'gifts', 'users', 'inventory', 'gameHistory', 'freeCaseProgress'].map(name => [name, table(name)]))
let currentUserId = null
class Query {
  from(target) { this.target = target; return this }
  orderBy() { return this }
  innerJoin() { return this }
  where() { return this }
  limit() { return this }
  then(resolve, reject) {
    const rows = this.target === tables.cases ? caseRows
      : this.target === tables.caseItems || this.target === tables.gifts ? giftRows
      : this.target === tables.users ? [{ lastFreeCaseAt: new Date('2026-01-01T00:00:00Z') }]
      : null
    assert.ok(rows, 'unexpected catalog query')
    return Promise.resolve(rows.map(row => ({ ...row }))).then(resolve, reject)
  }
}
const actions = load('app/actions/cases.ts', {
  crypto: {},
  'drizzle-orm': { asc: value => value, eq: () => true },
  'next/cache': { revalidatePath() { throw Error('Catalog read must not revalidate') } },
  '@/lib/db': { db: { select: () => new Query() } },
  '@/lib/db/schema': tables,
  '@/lib/session': { getCurrentUserId: async () => currentUserId },
  '@/lib/pricing': pricing,
  '@/lib/free-case': {},
  '@/lib/case-order': order,
})

async function testCatalog() {
  const before = JSON.stringify({ caseRows, giftRows })
  const expectedIds = [99, 8, 2, 11, 12, 3, 4, 1]
  const expectedPrices = [0, 12, 13, 100, 100, 199, 250, 1000]
  const anonymous = await actions.getCases()
  assert.deepEqual(ids(anonymous), expectedIds, 'sort completed DTOs, not stored prices or legacy sortOrder')
  assert.deepEqual(Array.from(anonymous, c => c.price), expectedPrices, 'preserve live, fallback, and promotional prices')
  assert.equal(anonymous[0].isFree, true)
  assert.equal(anonymous[0].nextFreeAt, null)
  assert.equal(anonymous.find(c => c.id === 1).items[0].value, 900)
  assert.equal(anonymous.find(c => c.id === 1).items[0].weight, 1)

  currentUserId = 'offline-user'
  const authenticated = await actions.getCases()
  assert.deepEqual(ids(authenticated), expectedIds, 'authenticated catalog must use the same order')
  assert.equal(authenticated[0].nextFreeAt, '2026-01-02T00:00:00.000Z')
  assert.equal((await actions.getCaseBySlug('cheap-live')).id, 2, 'slug lookup remains unchanged')
  assert.equal(await actions.getCaseBySlug('missing'), null)
  assert.equal(JSON.stringify({ caseRows, giftRows }), before, 'catalog ordering must not alter stored data or prizes')
  console.log('PASS getCases: effective prices, promos, fallback, free first, ID ties, auth parity, slug lookup')
}

async function main() { testComparator(); await testCatalog() }
main().catch(error => { console.error(error); process.exitCode = 1 })
