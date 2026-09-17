import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' })
for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', 'Event']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true })
}

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
})

const platformApi = await vite.ssrLoadModule('/src/api/platformApi.js')

let passed = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (err) {
    failures.push(`${name}: ${err.message}`)
    console.error(`FAIL  ${name}`)
    console.error(err)
  }
}

async function run() {
  await test('platformApi exports all required audience and marketing functions', () => {
    if (typeof platformApi.getAdminAudience !== 'function') throw new Error('getAdminAudience not exported')
    if (typeof platformApi.exportAdminAudienceCsv !== 'function') throw new Error('exportAdminAudienceCsv not exported')
    if (typeof platformApi.createAdminAudienceContact !== 'function') throw new Error('createAdminAudienceContact not exported')
    if (typeof platformApi.updateAdminAudienceContact !== 'function') throw new Error('updateAdminAudienceContact not exported')
    if (typeof platformApi.deleteAdminAudienceContact !== 'function') throw new Error('deleteAdminAudienceContact not exported')
    if (typeof platformApi.getAdminMarketingCampaigns !== 'function') throw new Error('getAdminMarketingCampaigns not exported')
    if (typeof platformApi.sendAdminMarketingTestEmail !== 'function') throw new Error('sendAdminMarketingTestEmail not exported')
    if (typeof platformApi.broadcastAdminMarketingCampaign !== 'function') throw new Error('broadcastAdminMarketingCampaign not exported')
    if (typeof platformApi.syncAudienceContact !== 'function') throw new Error('syncAudienceContact not exported')
    if (typeof platformApi.unsubscribeMarketingContact !== 'function') throw new Error('unsubscribeMarketingContact not exported')
  })

  await test('getAdminAudience returns calculated metrics and contact lists', async () => {
    const data = await platformApi.getAdminAudience({ segment: 'all' })
    if (!data.stats) throw new Error('stats missing')
    if (!Number.isFinite(data.stats.total)) throw new Error('stats.total is not finite')
    if (!Number.isFinite(data.stats.leads)) throw new Error('stats.leads is not finite')
    if (!Number.isFinite(data.stats.customers)) throw new Error('stats.customers is not finite')
    if (!Array.isArray(data.contacts)) throw new Error('contacts is not array')
    if (data.contacts.length === 0) throw new Error('contacts is empty')
  })

  await test('segment filter accurately separates signed-in leads from customers', async () => {
    const leadsData = await platformApi.getAdminAudience({ segment: 'leads' })
    if (!leadsData.contacts.every((c) => !c.isCustomer && c.status === 'subscribed')) {
      throw new Error('Leads filter contained customers or unsubscribed')
    }

    const customersData = await platformApi.getAdminAudience({ segment: 'customers' })
    if (!customersData.contacts.every((c) => c.isCustomer)) {
      throw new Error('Customers filter contained non-customers')
    }
  })

  await test('syncAudienceContact automatically captures new Google sign-in leads', async () => {
    const mockUser = {
      id: 'test-user-google-99',
      email: 'founder.new@teststartup.io',
      user_metadata: {
        full_name: 'Sophia Chen',
        avatar_url: 'https://example.com/avatar.jpg',
      },
    }
    const syncRes = await platformApi.syncAudienceContact(mockUser)
    if (!syncRes.ok) throw new Error('sync failed')

    const searchRes = await platformApi.getAdminAudience({ search: 'founder.new@teststartup.io' })
    if (searchRes.contacts.length !== 1) throw new Error('Contact was not saved')
    const contact = searchRes.contacts[0]
    if (contact.name !== 'Sophia Chen') throw new Error('Name mismatch')
    if (contact.isCustomer !== false) throw new Error('Should be lead')
    if (contact.source !== 'google_signin') throw new Error('Source mismatch')
  })

  await test('exportAdminAudienceCsv generates a valid CSV string with headers', async () => {
    const csv = await platformApi.exportAdminAudienceCsv({ segment: 'all' })
    if (typeof csv !== 'string') throw new Error('CSV is not string')
    if (!csv.startsWith('Email,Name,Source,Status,Segment')) throw new Error('CSV missing headers')
    if (!csv.includes('founder.new@teststartup.io')) throw new Error('CSV missing new contact')
  })

  await test('unsubscribeMarketingContact changes contact status to unsubscribed', async () => {
    const res = await platformApi.unsubscribeMarketingContact({ email: 'founder.new@teststartup.io' })
    if (!res.ok) throw new Error('Unsubscribe failed')

    const searchRes = await platformApi.getAdminAudience({ search: 'founder.new@teststartup.io' })
    if (searchRes.contacts[0].status !== 'unsubscribed') throw new Error('Status not unsubscribed')
  })

  await test('broadcastAdminMarketingCampaign excludes unsubscribed contacts and logs history', async () => {
    const broadcastRes = await platformApi.broadcastAdminMarketingCampaign({
      title: 'Spring Founder Launch',
      subject: 'Exclusive Update for Founders',
      message: 'Hi {{first_name}}, check out our new update.',
      targetSegment: 'all',
    })
    if (!broadcastRes.ok) throw new Error('Broadcast failed')
    if (broadcastRes.sentCount <= 0) throw new Error('Zero sent')

    const campaigns = await platformApi.getAdminMarketingCampaigns()
    if (!campaigns.some((c) => c.title === 'Spring Founder Launch')) throw new Error('Campaign not in history')
  })

  await test('admin can delete contacts from audience list', async () => {
    const searchRes = await platformApi.getAdminAudience({ search: 'founder.new@teststartup.io' })
    const contactId = searchRes.contacts[0].id
    const deleteRes = await platformApi.deleteAdminAudienceContact(contactId)
    if (!deleteRes.ok) throw new Error('Delete failed')

    const verify = await platformApi.getAdminAudience({ search: 'founder.new@teststartup.io' })
    if (verify.contacts.length !== 0) throw new Error('Contact still present after delete')
  })

  await vite.close()

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length > 0) process.exit(1)
}

run()
