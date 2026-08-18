// Product catalog: the marketing content for every product the storefront
// sells. Operational fields (prices, Lemon Squeezy variant IDs, delivery links,
// visibility) come from the platform API and are merged on top of this
// content by buildProductViewModel. Products managed through the owner
// dashboard but missing here receive a generic template.

export const SUITE_NAME = 'Runway Systems'

export const DEFAULT_SUPPORT_EMAIL = 'hello@yourdomain.com'

export const CATALOG_ORDER = ['cashflow-os', 'client-crm-os', 'project-os', 'invoice-os']

const TRUST = ['One-time payment', 'Instant access', 'Lifetime updates']

const SHARED_FAQS = [
  ['Does this work in Excel or Numbers?', 'No. Runway Systems products are built and tested exclusively for Google Sheets and use modern functions such as XLOOKUP, MAP, LAMBDA, and BYROW. Opening a product in Excel, Numbers, or LibreOffice can break formulas.'],
  ['What happens after I buy?', 'Lemon Squeezy securely processes your payment and sends you to a private delivery page with your Google Sheets "Make a Copy" link. You will also receive the link by email as a backup.'],
  ['Is my business data private?', 'Yes. Your copy lives in your Google account and Google Drive. The seller cannot view your clients, projects, invoices, or any other data you enter.'],
  ['Can I share it with my bookkeeper or team?', 'Yes. You control sharing from Google Sheets and can grant access to specific collaborators. The license covers personal or single-business use and does not allow resale or redistribution.'],
  ['Can I use a currency other than USD?', 'Yes, but the workbook is formatted in US dollars by default. You will need to manually apply your preferred custom currency format to each money column on the relevant tabs.'],
  ['What is the refund policy?', 'Because this is a digital product, purchases are generally non-refundable once accessed. If there is a genuine technical fault and the system does not work as described, contact support and we will make it right.'],
]

const DEFAULT_OFFER = {
  offerActive: true,
  offerLabel: 'Launch Offer',
  displayOriginalPrice: '$69',
  displaySalePrice: '$39',
}

export const CATALOG = {
  'cashflow-os': {
    key: 'cashflow-os',
    name: 'Cash Flow OS',
    category: 'Finance',
    icon: 'spreadsheet',
    accent: 'lime',
    ticker: ['CLIENT RISK', '12-MONTH FORECAST', 'LIFETIME UPDATES', 'GOOGLE SHEETS NATIVE', 'LIVE DASHBOARD', 'INVOICE AGING'],
    defaultOffer: { ...DEFAULT_OFFER },
    meta: {
      title: 'Cash Flow OS by Runway Systems | Business finance, made clear',
      description: 'Cash Flow OS is the Google Sheets finance system for freelancers, consultants, and small businesses. Track revenue, expenses, invoices, clients, and forecasts in one calm workspace.',
    },
    hero: {
      h1: ['Know your numbers.', 'Run with confidence.'],
      lede: 'The complete Google Sheets finance system for freelancers, consultants, and small businesses. Track every dollar, invoice, client, and forecast without becoming an accountant.',
      visual: {
        windowTitle: 'Cash Flow OS / Live Dashboard',
        logo: 'C',
        logoDot: 'OS',
        tabs: ['Dashboard', 'Revenue', 'Expenses', 'Forecast'],
        ribbon: [
          { label: 'Total revenue', value: '$113,000', delta: '+18.4%' },
          { label: 'Net profit', value: '$88,750', delta: 'Healthy' },
          { label: 'Margin', value: '78.5%', delta: '+4.2%' },
        ],
        screen: {
          src: '/product-dashboard-uhd.webp',
          alt: 'Cash Flow OS live dashboard showing revenue, expenses, profit, margin, runway, overdue invoices, and category totals',
        },
        floating: [
          { icon: 'trendingUp', tone: '', label: 'Net profit', value: '$88,750', em: '+18%' },
          { icon: 'receipt', tone: 'peach', label: 'Overdue invoices', value: '$0.00', badge: true },
          { icon: 'gauge', tone: 'blue', label: 'Cash runway', value: '24 mo', em: 'Stable' },
        ],
        cursorText: 'Updates automatically',
      },
    },
    proof: {
      audience: 'freelancers, consultants, creators & small teams',
      stats: [['11', 'connected views'], ['100%', 'inside your Drive'], ['0', 'monthly fees'], ['1', 'calm source of truth']],
    },
    problem: {
      heading: ['Clarity beats complexity', 'Your finances should not live in five tabs and your head.'],
      intro: 'Cash Flow OS turns scattered admin into one connected, self-updating system, so you can stop rebuilding reports and start making better decisions.',
      chaos: {
        label: 'Before Cash Flow OS',
        h3: ['Numbers everywhere.', 'Answers nowhere.'],
        papers: [['invoice_final_v3.pdf', '?'], ['expenses_march.xlsx', '#REF!'], ['Who still owes me?', '??'], ['Tax set-aside', '$___']],
        bullets: ['Manual totals that go stale', 'Late invoices missed', 'No idea what next month looks like'],
      },
      clarity: {
        label: 'With Cash Flow OS',
        h3: ['One system.', 'A clear next move.'],
        head: 'Financial overview',
        metrics: [{ label: 'Revenue', value: 113000, prefix: '$', em: '↗ 18%' }, { label: 'Net profit', value: 88750, prefix: '$', em: '78.5%' }],
        chartMax: '$100k',
        chartBars: [44, 68, 52, 82, 63, 92, 74, 100],
        bullets: ['Dashboard updates instantly', 'Overdue invoices surfaced', '12-month cash outlook included'],
      },
    },
    tour: {
      eyebrow: 'A finance department in one sheet',
      h2: ['Everything connected.', 'Nothing complicated.'],
      intro: 'Every view speaks to the next. Enter the data once and Cash Flow OS turns it into the numbers you need.',
      items: [
        {
          id: 'dashboard', number: '01', label: 'Dashboard', icon: 'layoutDashboard',
          title: 'See the health of your business at a glance.',
          copy: 'Revenue, expenses, profit, margin, tax reserve, burn rate, runway, overdue invoices, and category totals stay together in one live command center.',
          screen: { src: '/product-dashboard-uhd.webp', alt: 'Cash Flow OS dashboard with revenue, expenses, net profit, margin, runway, overdue invoices, and category totals', label: 'LIVE COMMAND CENTER', name: 'Business dashboard', variant: 'dashboard', aspectRatio: '3840 / 1800', metrics: [{ label: 'Total revenue', value: 113000, prefix: '$' }, { label: 'Net profit', value: 88750, prefix: '$' }, { label: 'Runway', value: 24, suffix: ' mo' }] },
        },
        {
          id: 'invoices', number: '02', label: 'Invoices', icon: 'receipt',
          title: 'Know exactly what was paid and what needs chasing.',
          copy: 'Track invoice numbers, clients, sent and due dates, amounts, payment status, days overdue, and payment dates in one color-coded view.',
          screen: { src: '/product-invoices-uhd.webp', alt: 'Cash Flow OS invoice register with clients, due dates, amounts, statuses, overdue days, and payment dates', label: 'RECEIVABLES', name: 'Invoice register', variant: 'invoices', aspectRatio: '3840 / 1075', metrics: [{ label: 'Invoices tracked', value: 17 }, { label: 'Overdue invoices', value: 3 }, { label: 'Total overdue', value: 15500, prefix: '$', tone: 'warn' }] },
        },
        {
          id: 'revenue', number: '03', label: 'Revenue', icon: 'barChart3',
          title: 'Understand where revenue comes from and where cash is going.',
          copy: 'Compare revenue categories against cumulative cash growth so today’s income stays connected to the longer-term trajectory.',
          screen: { src: '/product-revenue-cash-uhd.webp', alt: 'Cash Flow OS revenue category breakdown and twelve-month cumulative cash growth projection', label: 'REVENUE & CASH', name: 'Growth projection', variant: 'charts', aspectRatio: '3840 / 1410', metrics: [{ label: 'Total revenue', value: 113000, prefix: '$' }, { label: 'Projected cash', value: 88750, prefix: '$' }, { label: 'Outlook', text: 'Positive', tone: 'up' }] },
        },
        {
          id: 'forecast', number: '04', label: 'Forecast charts', icon: 'trendingUp',
          title: 'Look forward, not just backward.',
          copy: 'Projected revenue, projected expenses, and cumulative cash make the next twelve months visible without rebuilding a report.',
          screen: { src: '/product-forecast-charts-uhd.webp', alt: 'Cash Flow OS projected revenue, projected expenses, and cumulative cash charts for twelve months', label: 'FORWARD VIEW', name: '12-month forecast charts', variant: 'forecast', aspectRatio: '3840 / 1040', metrics: [{ label: 'Projected net', value: 88750, prefix: '$' }, { label: 'Tax set-aside', value: 24850, prefix: '$' }, { label: 'Cash trend', text: '↗ Positive', tone: 'up' }] },
        },
        {
          id: 'forecast-table', number: '05', label: 'Forecast table', icon: 'fileSpreadsheet',
          title: 'Inspect every month behind the forecast.',
          copy: 'Review projected revenue, expenses, net income, tax set-aside, and cumulative cash month by month. Totals are calculated automatically.',
          screen: { src: '/product-forecast-table-uhd.webp', alt: 'Cash Flow OS twelve-month forecast table with projected revenue, expenses, net, tax set-aside, and cumulative cash', label: 'MONTH-BY-MONTH', name: 'Automated forecast table', variant: 'invoices', aspectRatio: '3840 / 1033', metrics: [{ label: 'Projected revenue', value: 113000, prefix: '$' }, { label: 'Projected expenses', value: 24250, prefix: '$' }, { label: 'Projected net', value: 88750, prefix: '$' }] },
        },
        {
          id: 'performance', number: '06', label: 'Performance', icon: 'gauge',
          title: 'Compare revenue and expenses without losing the details.',
          copy: 'Monthly performance and expense-category charts reveal seasonal movement, spending spikes, and the costs shaping profitability.',
          screen: { src: '/product-revenue-expenses-uhd.webp', alt: 'Cash Flow OS revenue versus expenses chart and expenses category breakdown', label: 'PERFORMANCE', name: 'Revenue vs. expenses', variant: 'charts', aspectRatio: '3840 / 1485', metrics: [{ label: 'Revenue', value: 113000, prefix: '$' }, { label: 'Expenses', value: 24250, prefix: '$' }, { label: 'Margin', value: 78.5, suffix: '%', decimals: 1 }] },
        },
        {
          id: 'categories', number: '07', label: 'Categories', icon: 'pieChart',
          title: 'See which work earns the most and where money is spent.',
          copy: 'Revenue and expense category visuals turn long transaction lists into a clear picture of business mix and operating costs.',
          screen: { src: '/product-categories-uhd.webp', alt: 'Cash Flow OS revenue pie chart and horizontal expenses by category chart', label: 'CATEGORY MIX', name: 'Revenue & expense categories', variant: 'categories', aspectRatio: '3840 / 1347', metrics: [{ label: 'Top revenue source', text: 'Project fees' }, { label: 'Largest expense', text: 'Office & rent' }, { label: 'Views connected', value: 2 }] },
        },
        {
          id: 'risk', number: '08', label: 'Risk signals', icon: 'shieldCheck',
          title: 'Surface overdue cash and client concentration risk early.',
          copy: 'Invoice-aging totals and top-client concentration sit together, helping you identify collection pressure and dependency before they become surprises.',
          screen: { src: '/product-risk-uhd.webp', alt: 'Cash Flow OS invoice aging totals and client concentration risk status', label: 'DECISION SIGNALS', name: 'Aging & concentration risk', variant: 'risk', aspectRatio: '3840 / 355', metrics: [{ label: 'Total overdue', value: 15500, prefix: '$', tone: 'warn' }, { label: 'Top client', text: 'Globex' }, { label: 'Risk status', text: '✓ Safe', tone: 'up' }] },
        },
      ],
    },
    features: {
      eyebrow: 'Built to run the whole back office',
      h2: ['More control.', 'Far less admin.'],
      intro: 'From the first payment to the year-ahead forecast, every core finance workflow has a clear home.',
      cards: [
        { icon: 'layoutDashboard', title: 'Live financial dashboard', copy: 'Filter all time, month, quarter, or year and see every important number refresh instantly.', tone: 'mint' },
        { icon: 'clock3', title: 'Invoice aging', copy: 'Group overdue invoices into 1-30, 31-60, and 61-90+ day buckets automatically.', tone: 'peach' },
        { icon: 'users', title: 'Client intelligence', copy: 'Track billed, paid, outstanding, and revenue concentration for every client.', tone: 'blue' },
        { icon: 'trendingUp', title: '12-month forecast', copy: 'See projected revenue, expenses, tax set-aside, net, and cumulative cash.', tone: 'lime' },
        { icon: 'fileCheck2', title: 'Invoice generator', copy: 'Choose an invoice number and export a clean, client-ready PDF in a few clicks.', tone: 'lavender' },
        { icon: 'refreshCw', title: 'Connected automation', copy: 'Settings, categories, statuses, and linked records stay consistent across the system.', tone: 'yellow' },
      ],
      privacy: {
        h3: 'Your numbers stay yours.',
        copy: 'Everything lives inside your private Google Drive. Your revenue, clients, and expenses are never sent to us or anyone else.',
        points: ['No external database', 'You control sharing', 'You own your copy'],
      },
    },
    steps: {
      eyebrow: 'From blank to business-ready',
      h2: ['Set up in minutes.', 'Useful for years.'],
      intro: 'No migration project. No complicated onboarding. No new app to learn.',
      items: [
        { number: '01', icon: 'fileSpreadsheet', title: 'Make your private copy', copy: 'Purchase once and open your own protected copy inside Google Sheets.' },
        { number: '02', icon: 'gauge', title: 'Set your preferences', copy: 'Choose your tax reserve and tailor categories to the way your business works.' },
        { number: '03', icon: 'banknote', title: 'Add your real numbers', copy: 'Log revenue, expenses, invoices, and clients with simple dropdowns and inputs.' },
        { number: '04', icon: 'barChart3', title: 'Make clearer decisions', copy: 'Your dashboard, risk signals, and 12-month outlook update automatically.' },
      ],
      note: {
        title: 'Built exclusively for Google Sheets',
        body: 'Works in your browser and Google Sheets mobile app. Desktop is recommended for initial setup.',
      },
    },
    benefits: {
      heading: 'Spend less time finding numbers. More time using them.',
      copy: 'Cash Flow OS doesn’t add another layer of process. It removes the repeated work between logging a transaction and understanding what it means.',
      items: [
        { icon: 'zap', title: 'Move faster', copy: 'Weekly finance admin becomes a short, repeatable routine.' },
        { icon: 'circleDollarSign', title: 'Protect your cash', copy: 'Tax reserves, overdue invoices, and burn rate stay visible.' },
        { icon: 'trendingUp', title: 'Plan with context', copy: 'See how today’s decisions affect the months ahead.' },
      ],
      outcome: {
        label: 'Cash confidence',
        gaugeValue: 88,
        gaugeLabel: 'STRONG',
        stats: [{ label: 'Cash runway', value: 18.2, suffix: ' months', decimals: 1 }, { label: 'Overdue', value: 0, prefix: '$', decimals: 2 }],
        backOne: { label: 'Tax reserve ready', value: 24850, prefix: '$' },
        backTwo: { label: 'Profit margin', value: 78.5, suffix: '%', decimals: 1 },
      },
    },
    audiences: {
      eyebrow: 'Made for independent business',
      h2: ['The calmer way to stay on top of money.'],
      intro: 'Whether you sell your time, retainers, or creative work, Cash Flow OS gives every dollar a clear place.',
      cards: [
        { icon: 'walletCards', role: 'Freelancers', line: 'See what you earned, what you can spend, and what needs to be set aside.' },
        { icon: 'sparkles', role: 'Creative studios', line: 'Keep client balances and revenue concentration visible as your roster grows.' },
        { icon: 'users', role: 'Consultants', line: 'Turn invoices and irregular payments into a reliable month-by-month view.' },
      ],
      note: 'No accounting background required. If you can use a spreadsheet, you can run Cash Flow OS.',
    },
    pricing: {
      eyebrow: 'One system. One payment.',
      h2: ['Build financial clarity for less than one late fee.'],
      intro: 'No subscription. No per-user pricing. No paying more as your business grows.',
      reassurance: ['Secure Lemon Squeezy checkout', 'Instant access after payment', 'Free future updates'],
      included: [
        'Live finance dashboard',
        'Revenue & expense trackers',
        'Invoice aging & client records',
        '12-month cash forecast',
        'Invoice PDF template',
        'Bank import staging area',
        'Private Google Sheets copy',
        'All future updates',
      ],
      priceSub: 'Your complete finance and admin workspace in Google Sheets.',
      license: 'Personal / single-business license',
      licenseBody: 'Use it for your own business or one you manage.',
    },
    faqs: {
      eyebrow: 'Questions, answered',
      h2: ['Everything you need to know.'],
      items: [
        ['Does Cash Flow OS work in Excel or Numbers?', 'No. Cash Flow OS is built and tested exclusively for Google Sheets and uses modern functions such as XLOOKUP, MAP, LAMBDA, and BYROW. Opening it in Excel, Numbers, or LibreOffice can break formulas.'],
        ['Do I need accounting experience?', 'Not at all. Editable cells, protected formulas, dropdowns, and a clear four-step setup make the system approachable even if finance is not your thing.'],
        ['What happens after I buy?', 'Lemon Squeezy securely processes your payment and sends you to a private delivery page with your Google Sheets "Make a Copy" link. You will also receive the link by email as a backup.'],
        ['Can I change the categories and tax rate?', 'Yes. The Settings tab controls your tax reserve rate and every category list used across the system. Update a category once and it appears everywhere it is used.'],
        ...SHARED_FAQS.slice(4),
      ],
    },
    finalCta: {
      eyebrow: 'Your clearest financial year starts here',
      h2: ['Stop guessing.', 'Start seeing.'],
      copy: 'One calm system for the numbers that keep your business moving.',
      small: ['Instant access', 'One-time payment', 'Lifetime updates'],
    },
  },

  'client-crm-os': {
    key: 'client-crm-os',
    name: 'Client CRM OS',
    category: 'Client relationships',
    icon: 'users',
    accent: 'blue',
    ticker: ['CLIENT PIPELINE', 'FOLLOW-UP LOG', 'REVENUE PER CLIENT', 'RETENTION SIGNALS', 'GOOGLE SHEETS NATIVE', 'LIFETIME UPDATES'],
    defaultOffer: { offerActive: true, offerLabel: 'Launch Offer', displayOriginalPrice: '$59', displaySalePrice: '$35' },
    meta: {
      title: 'Client CRM OS by Runway Systems | Know every client',
      description: 'Client CRM OS is the Google Sheets client system for freelancers and small studios. Track pipeline, follow-ups, revenue per client, and retention in one calm workspace.',
    },
    hero: {
      h1: ['Know every client.', 'Win the next one.'],
      lede: 'The complete Google Sheets client system for freelancers and small studios. Track every conversation, proposal, follow-up, and renewal without a bloated CRM subscription.',
      visual: {
        windowTitle: 'Client CRM OS / Pipeline',
        logo: 'C',
        logoDot: 'RM',
        tabs: ['Pipeline', 'Clients', 'Follow-ups', 'Revenue'],
        ribbon: [
          { label: 'Active clients', value: '26', delta: '+12%' },
          { label: 'Revenue per client', value: '$4.3k', delta: 'Healthy' },
          { label: 'Follow-ups due', value: '7', delta: 'Due soon' },
        ],
        mock: {
          variant: 'pipeline',
          columns: [
            { title: 'New lead', count: 4, cards: [{ t: 'Aster Studio', tag: 'Intro call' }, { t: 'Brio Works', tag: 'Proposal sent' }] },
            { title: 'Active', count: 5, cards: [{ t: 'Globex', tag: 'Project live' }, { t: 'Northwind', tag: 'Retainer' }] },
            { title: 'Renewal', count: 3, cards: [{ t: 'Kepler Co', tag: 'Renewal due' }, { t: 'Fern & Co', tag: 'Q3 renewal' }] },
          ],
        },
        floating: [
          { icon: 'layers', tone: '', label: 'Open deals', value: '38', em: '+18%' },
          { icon: 'clock3', tone: 'peach', label: 'Overdue follow-ups', value: '2', badge: true },
          { icon: 'users', tone: 'blue', label: 'Renewals this month', value: '5', em: 'On track' },
        ],
        cursorText: 'Updates automatically',
      },
    },
    proof: {
      audience: 'freelancers, studios & small agencies',
      stats: [['26', 'active clients'], ['100%', 'inside your Drive'], ['0', 'monthly fees'], ['1', 'place for every follow-up']],
    },
    problem: {
      heading: ['Relationships are the business', 'Your clients should not live in five tabs and your head.'],
      intro: 'Client CRM OS turns scattered inboxes, notes, and spreadsheets into one connected, self-updating view of every relationship.',
      chaos: {
        label: 'Before Client CRM OS',
        h3: ['Follow-ups forgotten.', 'Renewals missed.'],
        papers: [['follow_up_march.txt', '?'], ['client_notes_final_v2.docx', '?'], ['Who needs a check-in?', '??'], ['Renewal dates', '$___']],
        bullets: ['Manual lists that go stale', 'Follow-ups slip through', 'No idea which clients drive revenue'],
      },
      clarity: {
        label: 'With Client CRM OS',
        h3: ['One log.', 'A clear next call.'],
        head: 'Client overview',
        metrics: [{ label: 'Revenue', value: 113000, prefix: '$', em: '↗ 18%' }, { label: 'Active clients', value: 26, em: '92% retained' }],
        chartMax: '$100k',
        chartBars: [38, 46, 58, 61, 72, 79, 88, 96],
        bullets: ['Every touchpoint logged', 'Overdue follow-ups surfaced', 'Revenue per client visible'],
      },
    },
    tour: {
      eyebrow: 'A client department in one sheet',
      h2: ['Every relationship connected.', 'Nothing dropped.'],
      intro: 'Each view feeds the next. Log a call once and Client CRM OS turns it into the follow-ups, revenue, and retention signals you need.',
      items: [
        {
          id: 'pipeline', number: '01', label: 'Pipeline', icon: 'layers',
          title: 'See every deal and where it stands.',
          copy: 'Move each relationship from new lead to active client to renewal with a clear stage for every account.',
          mock: { variant: 'pipeline', columns: [{ title: 'New lead', count: 4, cards: [{ t: 'Aster Studio', tag: 'Intro call' }, { t: 'Brio Works', tag: 'Proposal sent' }] }, { title: 'Active', count: 5, cards: [{ t: 'Globex', tag: 'Project live' }, { t: 'Northwind', tag: 'Retainer' }] }, { title: 'Renewal', count: 3, cards: [{ t: 'Kepler Co', tag: 'Renewal due' }, { t: 'Fern & Co', tag: 'Q3 renewal' }] }] },
        },
        {
          id: 'client-log', number: '02', label: 'Client log', icon: 'users',
          title: 'Every conversation in one place.',
          copy: 'Names, last touch, next step, and status stay together so no client history lives only in your inbox.',
          mock: { variant: 'table', title: 'Client log', rows: [['Aster Studio', 'Tue, proposal review', 'Proposal sent', 'active'], ['Globex', 'Mon, weekly sync', 'Project live', 'active'], ['Brio Works', 'Fri, discovery call', 'Awaiting scope', 'pending'], ['Fern & Co', '14 days ago', 'Renewal check-in', 'due']] },
        },
        {
          id: 'revenue', number: '03', label: 'Revenue', icon: 'barChart3',
          title: 'Know who drives your business.',
          copy: 'Compare billed, paid, and outstanding per client so concentration risk and quiet accounts are easy to spot.',
          mock: { variant: 'chart', bars: [{ label: 'Globex', height: 92, value: '$38k' }, { label: 'Northwind', height: 68, value: '$28k' }, { label: 'Kepler Co', height: 48, value: '$19k' }, { label: 'Aster', height: 31, value: '$12k' }, { label: 'Brio', height: 18, value: '$7k' }] },
        },
        {
          id: 'follow-ups', number: '04', label: 'Follow-ups', icon: 'clock3',
          title: 'Never drop a check-in again.',
          copy: 'Overdue and upcoming follow-ups surface automatically, ordered by priority and due date.',
          mock: { variant: 'table', title: 'Follow-up queue', rows: [['Fern & Co', 'Renewal call', 'Today', 'due'], ['Aster Studio', 'Send proposal', 'Tomorrow', 'pending'], ['Kepler Co', 'Check-in email', 'In 3 days', 'active'], ['Brio Works', 'Share case study', 'In 5 days', 'active']] },
        },
      ],
    },
    features: {
      eyebrow: 'Built to run the whole client cycle',
      h2: ['More rapport.', 'Far less admin.'],
      intro: 'From the first intro call to the fifth renewal, every relationship workflow has a clear home.',
      cards: [
        { icon: 'layers', title: 'Client pipeline board', copy: 'Move each relationship from lead to repeat client with one glance.', tone: 'blue' },
        { icon: 'clock3', title: 'Follow-up queue', copy: 'Overdue check-ins surface automatically, ordered by priority.', tone: 'peach' },
        { icon: 'barChart3', title: 'Revenue per client', copy: 'Compare billed, paid, and outstanding for every account.', tone: 'mint' },
        { icon: 'heartHandshake', title: 'Retention signals', copy: 'Spot quiet clients early with touchpoint and recency tracking.', tone: 'lavender' },
        { icon: 'fileText', title: 'Meeting notes archive', copy: 'Keep decisions, promises, and next steps attached to the client.', tone: 'yellow' },
        { icon: 'zap', title: 'Referral tracker', copy: 'See who sends you work and thank them on time.', tone: 'lime' },
      ],
      privacy: {
        h3: 'Your relationships stay yours.',
        copy: 'Everything lives inside your private Google Drive. Client names, notes, and revenue are never sent to us or anyone else.',
        points: ['No external database', 'You control sharing', 'You own your copy'],
      },
    },
    steps: {
      eyebrow: 'From inbox chaos to client clarity',
      h2: ['Set up in minutes.', 'Useful for years.'],
      intro: 'No migration project. No complicated onboarding. No new app to learn.',
      items: [
        { number: '01', icon: 'fileSpreadsheet', title: 'Make your private copy', copy: 'Purchase once and open your own protected copy inside Google Sheets.' },
        { number: '02', icon: 'users', title: 'Add your clients', copy: 'Import your active accounts and set each relationship’s stage.' },
        { number: '03', icon: 'clock3', title: 'Log the conversation', copy: 'Record calls, emails, and next steps as they happen.' },
        { number: '04', icon: 'layers', title: 'Close the next deal', copy: 'Your pipeline, follow-ups, and renewals update automatically.' },
      ],
      note: {
        title: 'Built exclusively for Google Sheets',
        body: 'Works in your browser and Google Sheets mobile app. Desktop is recommended for initial setup.',
      },
    },
    benefits: {
      heading: 'Spend less time remembering. More time closing.',
      copy: 'Client CRM OS doesn’t add another layer of process. It removes the repeated work between a conversation and the next step it requires.',
      items: [
        { icon: 'zap', title: 'Move faster', copy: 'Every client detail is one glance away.' },
        { icon: 'heartHandshake', title: 'Keep promises', copy: 'Follow-ups and renewals never slip.' },
        { icon: 'trendingUp', title: 'Grow deliberately', copy: 'See which relationships deserve more attention.' },
      ],
      outcome: {
        label: 'Client confidence',
        gaugeValue: 92,
        gaugeLabel: 'RETAINED',
        stats: [{ label: 'Active clients', value: 26 }, { label: 'Overdue follow-ups', value: 0, decimals: 0 }],
        backOne: { label: 'Renewal rate', value: 84, suffix: '%' },
        backTwo: { label: 'Revenue per client', value: 4350, prefix: '$' },
      },
    },
    audiences: {
      eyebrow: 'Made for relationship-led business',
      h2: ['The calmer way to keep every client.'],
      intro: 'Whether you sell retainers, projects, or creative work, Client CRM OS gives every relationship a clear place.',
      cards: [
        { icon: 'walletCards', role: 'Freelancers', line: 'See who to follow up with and which clients are quietly drifting.' },
        { icon: 'sparkles', role: 'Creative studios', line: 'Keep pitches, retainer renewals, and client revenue in one view.' },
        { icon: 'users', role: 'Consultants', line: 'Turn scattered conversations into a reliable renewal pipeline.' },
      ],
      note: 'No CRM experience required. If you can use a spreadsheet, you can run Client CRM OS.',
    },
    pricing: {
      eyebrow: 'One system. One payment.',
      h2: ['Keep every client for less than one missed renewal.'],
      intro: 'No subscription. No per-seat pricing. No paying more as your roster grows.',
      reassurance: ['Secure Lemon Squeezy checkout', 'Instant access after payment', 'Free future updates'],
      included: [
        'Client pipeline board',
        'Follow-up & touchpoint log',
        'Revenue per client',
        'Retention & churn signals',
        'Meeting notes archive',
        'Referral tracker',
        'Private Google Sheets copy',
        'All future updates',
      ],
      priceSub: 'Your complete client relationship workspace in Google Sheets.',
      license: 'Personal / single-business license',
      licenseBody: 'Use it for your own business or one you manage.',
    },
    faqs: {
      eyebrow: 'Questions, answered',
      h2: ['Everything you need to know.'],
      items: [
        ['Does Client CRM OS replace my email?', 'No. Email stays where conversations happen. Client CRM OS is the shared log where decisions, follow-ups, and renewal dates live so nothing is lost in a thread.'],
        ['Can I import my existing clients?', 'Yes. Paste your client list into the Clients tab and set each relationship’s stage and next step.'],
        ['What happens after I buy?', 'Lemon Squeezy securely processes your payment and sends you to a private delivery page with your Google Sheets "Make a Copy" link. You will also receive the link by email as a backup.'],
        ['Is my business data private?', 'Yes. Your copy lives in your Google account and Google Drive. The seller cannot view your clients, notes, or revenue data.'],
        ...SHARED_FAQS.slice(4),
      ],
    },
    finalCta: {
      eyebrow: 'Your clearest client year starts here',
      h2: ['Stop losing track of clients.', 'Start closing repeat work.'],
      copy: 'One calm system for every relationship that keeps your business moving.',
      small: ['Instant access', 'One-time payment', 'Lifetime updates'],
    },
  },

  'project-os': {
    key: 'project-os',
    name: 'Project OS',
    category: 'Projects',
    icon: 'gauge',
    accent: 'violet',
    ticker: ['PROJECT TRACKER', 'MILESTONES', 'BUDGET VS. ACTUAL', 'WORKLOAD BOARD', 'GOOGLE SHEETS NATIVE', 'LIFETIME UPDATES'],
    defaultOffer: { offerActive: true, offerLabel: 'Launch Offer', displayOriginalPrice: '$79', displaySalePrice: '$49' },
    meta: {
      title: 'Project OS by Runway Systems | Plan the work. Watch the runway.',
      description: 'Project OS is the Google Sheets project system for small teams and solo builders. Track scope, milestones, budgets, and deadlines in one calm workspace.',
    },
    hero: {
      h1: ['Plan the work.', 'Watch the runway.'],
      lede: 'The complete Google Sheets project system for small teams and solo builders. Track scope, milestones, budgets, and deadlines without another subscription.',
      visual: {
        windowTitle: 'Project OS / Overview',
        logo: 'P',
        logoDot: 'OS',
        tabs: ['Overview', 'Timeline', 'Budget', 'Team'],
        ribbon: [
          { label: 'Active projects', value: '6', delta: 'On scope' },
          { label: 'On-time delivery', value: '94%', delta: '+3%' },
          { label: 'Budget used', value: '61%', delta: 'Healthy' },
        ],
        mock: {
          variant: 'dashboard',
          metrics: [
            { label: 'Projects', value: '6' },
            { label: 'Milestones done', value: '21' },
            { label: 'Overdue', value: '0' },
          ],
          bars: [
            { label: 'Atlas launch', height: 88, value: '$12k' },
            { label: 'Kepler site', height: 64, value: '$9k' },
            { label: 'Brio brand', height: 45, value: '$6k' },
            { label: 'Fern app', height: 27, value: '$4k' },
          ],
        },
        floating: [
          { icon: 'target', tone: '', label: 'Milestones done', value: '21', em: '+18%' },
          { icon: 'clock3', tone: 'peach', label: 'Overdue tasks', value: '0', badge: true },
          { icon: 'gauge', tone: 'blue', label: 'Runway', value: '9 wk', em: 'Stable' },
        ],
        cursorText: 'Updates automatically',
      },
    },
    proof: {
      audience: 'solo builders, studios & small teams',
      stats: [['6', 'active projects'], ['94%', 'on-time delivery'], ['0', 'missed milestones'], ['1', 'shared source of truth']],
    },
    problem: {
      heading: ['Projects outgrow sticky notes', 'Your work should not live in five tabs and your head.'],
      intro: 'Project OS turns scattered task lists, budgets, and deadlines into one connected, self-updating view of every project.',
      chaos: {
        label: 'Before Project OS',
        h3: ['Deadlines drift.', 'Budgets surprise.'],
        papers: [['task_list_v7.xlsx', '#REF!'], ['budget_guess.xlsx', '?'], ['When is this due?', '??'], ['Who owns this?', '??']],
        bullets: ['Manual trackers that go stale', 'Milestones slip quietly', 'No idea how the budget is tracking'],
      },
      clarity: {
        label: 'With Project OS',
        h3: ['One plan.', 'A clear next move.'],
        head: 'Project overview',
        metrics: [{ label: 'Milestones done', value: 21, em: '↗ 18%' }, { label: 'Budget used', value: 61, suffix: '%', em: 'On track' }],
        chartMax: '$15k',
        chartBars: [30, 42, 55, 48, 66, 74, 85, 93],
        bullets: ['Status updates instantly', 'Overdue tasks surfaced', 'Budget vs. actual included'],
      },
    },
    tour: {
      eyebrow: 'A project office in one sheet',
      h2: ['Every project connected.', 'Nothing slips.'],
      intro: 'Each view feeds the next. Log progress once and Project OS turns it into the timeline, budget, and workload you need.',
      items: [
        {
          id: 'overview', number: '01', label: 'Overview', icon: 'layoutDashboard',
          title: 'See the health of every project at a glance.',
          copy: 'Projects, milestones, overdue tasks, and budget burn stay together in one live command center.',
          mock: { variant: 'dashboard', metrics: [{ label: 'Projects', value: '6' }, { label: 'Milestones done', value: '21' }, { label: 'Overdue', value: '0' }], bars: [{ label: 'Atlas launch', height: 88, value: '$12k' }, { label: 'Kepler site', height: 64, value: '$9k' }, { label: 'Brio brand', height: 45, value: '$6k' }, { label: 'Fern app', height: 27, value: '$4k' }] },
        },
        {
          id: 'timeline', number: '02', label: 'Timeline', icon: 'calendarRange',
          title: 'See the milestones that matter.',
          copy: 'Project timelines and deadline risk sit together so late milestones are visible before they happen.',
          mock: { variant: 'timeline', milestones: [{ label: 'Kickoff', pos: 8, done: true }, { label: 'Design review', pos: 30, done: true }, { label: 'Build', pos: 52, done: true }, { label: 'Launch', pos: 74, done: false }, { label: 'Wrap-up', pos: 92, done: false }] },
        },
        {
          id: 'budget', number: '03', label: 'Budget', icon: 'circleDollarSign',
          title: 'Know what the work is costing.',
          copy: 'Budget vs. actual per project makes overruns visible while there is still time to adjust.',
          mock: { variant: 'chart', bars: [{ label: 'Atlas', height: 88, value: '$12k' }, { label: 'Kepler', height: 64, value: '$9k' }, { label: 'Brio', height: 45, value: '$6k' }, { label: 'Fern', height: 27, value: '$4k' }] },
        },
        {
          id: 'workload', number: '04', label: 'Workload', icon: 'users',
          title: 'See who is loaded and who has room.',
          copy: 'Task ownership and open items per person make resourcing decisions easy.',
          mock: { variant: 'table', title: 'Workload board', rows: [['Maya', 'Atlas launch', '3 open tasks', 'active'], ['Dev', 'Kepler site', '1 open task', 'active'], ['Rae', 'Brio brand', '4 open tasks', 'due'], ['Sam', 'Fern app', '2 open tasks', 'pending']] },
        },
      ],
    },
    features: {
      eyebrow: 'Built to run the whole project cycle',
      h2: ['More shipped.', 'Far less chasing.'],
      intro: 'From kickoff to wrap-up, every core project workflow has a clear home.',
      cards: [
        { icon: 'layoutDashboard', title: 'Project overview', copy: 'See status, budget, and overdue items for every project at once.', tone: 'violet' },
        { icon: 'calendarRange', title: 'Milestone timeline', copy: 'Track deadlines and flag late milestones before they cascade.', tone: 'blue' },
        { icon: 'circleDollarSign', title: 'Budget vs. actual', copy: 'Watch burn against plan and adjust while there is time.', tone: 'mint' },
        { icon: 'users', title: 'Workload board', copy: 'See who owns what and who has room for the next project.', tone: 'peach' },
        { icon: 'listChecks', title: 'Deliverable checklist', copy: 'Keep every handoff, review, and sign-off in one place.', tone: 'lavender' },
        { icon: 'shieldCheck', title: 'Deadline risk signals', copy: 'Overdue and at-risk milestones surface automatically.', tone: 'yellow' },
      ],
      privacy: {
        h3: 'Your plans stay yours.',
        copy: 'Everything lives inside your private Google Drive. Scope, budgets, and deadlines are never sent to us or anyone else.',
        points: ['No external database', 'You control sharing', 'You own your copy'],
      },
    },
    steps: {
      eyebrow: 'From blank sheet to running project',
      h2: ['Set up in minutes.', 'Useful for years.'],
      intro: 'No migration project. No complicated onboarding. No new app to learn.',
      items: [
        { number: '01', icon: 'fileSpreadsheet', title: 'Make your private copy', copy: 'Purchase once and open your own protected copy inside Google Sheets.' },
        { number: '02', icon: 'target', title: 'Set your milestones', copy: 'Add projects, milestones, and deadlines with simple inputs.' },
        { number: '03', icon: 'listChecks', title: 'Log real progress', copy: 'Update tasks, budgets, and owners as work happens.' },
        { number: '04', icon: 'gauge', title: 'Ship on time', copy: 'Your overview, timeline, and risk signals update automatically.' },
      ],
      note: {
        title: 'Built exclusively for Google Sheets',
        body: 'Works in your browser and Google Sheets mobile app. Desktop is recommended for initial setup.',
      },
    },
    benefits: {
      heading: 'Spend less time tracking. More time shipping.',
      copy: 'Project OS doesn’t add another layer of process. It removes the repeated work between updating a task and knowing what it means for the project.',
      items: [
        { icon: 'zap', title: 'Move faster', copy: 'Every project detail is one glance away.' },
        { icon: 'circleDollarSign', title: 'Protect the budget', copy: 'Burn and overruns stay visible.' },
        { icon: 'trendingUp', title: 'Plan with context', copy: 'See how today’s slip affects the milestone after it.' },
      ],
      outcome: {
        label: 'Project confidence',
        gaugeValue: 94,
        gaugeLabel: 'ON TRACK',
        stats: [{ label: 'On-time delivery', value: 94, suffix: '%' }, { label: 'Overdue', value: 0, decimals: 0 }],
        backOne: { label: 'Milestones done', value: 21 },
        backTwo: { label: 'Budget used', value: 61, suffix: '%' },
      },
    },
    audiences: {
      eyebrow: 'Made for people who ship',
      h2: ['The calmer way to deliver.'],
      intro: 'Whether you build sites, brands, or apps, Project OS gives every milestone a clear place.',
      cards: [
        { icon: 'walletCards', role: 'Solo builders', line: 'See every deadline, budget, and open task without a project manager.' },
        { icon: 'sparkles', role: 'Creative studios', line: 'Keep client projects, reviews, and budgets in one shared view.' },
        { icon: 'users', role: 'Small teams', line: 'Know who owns what and which milestones are at risk.' },
      ],
      note: 'No project management background required. If you can use a spreadsheet, you can run Project OS.',
    },
    pricing: {
      eyebrow: 'One system. One payment.',
      h2: ['Ship on time for less than one missed deadline.'],
      intro: 'No subscription. No per-seat pricing. No paying more as your team grows.',
      reassurance: ['Secure Lemon Squeezy checkout', 'Instant access after payment', 'Free future updates'],
      included: [
        'Project & milestone tracker',
        'Timeline & deadline view',
        'Budget vs. actual burn',
        'Team workload board',
        'Deliverable checklist',
        'Status dashboard',
        'Private Google Sheets copy',
        'All future updates',
      ],
      priceSub: 'Your complete project planning workspace in Google Sheets.',
      license: 'Personal / single-business license',
      licenseBody: 'Use it for your own business or one you manage.',
    },
    faqs: {
      eyebrow: 'Questions, answered',
      h2: ['Everything you need to know.'],
      items: [
        ['Does Project OS replace my task app?', 'It can. Project OS keeps projects, milestones, budgets, and ownership connected, which task lists usually do not. Many owners keep their daily to-do app and run the plan in Project OS.'],
        ['Can I manage multiple projects?', 'Yes. Add as many projects as you need. The overview, timeline, and workload views stay connected across all of them.'],
        ['What happens after I buy?', 'Lemon Squeezy securely processes your payment and sends you to a private delivery page with your Google Sheets "Make a Copy" link. You will also receive the link by email as a backup.'],
        ['Is my business data private?', 'Yes. Your copy lives in your Google account and Google Drive. The seller cannot view your projects, budgets, or deadlines.'],
        ...SHARED_FAQS.slice(4),
      ],
    },
    finalCta: {
      eyebrow: 'Your clearest delivery run starts here',
      h2: ['Stop tracking projects in your head.', 'Start shipping on time.'],
      copy: 'One calm system for every project that keeps your business moving.',
      small: ['Instant access', 'One-time payment', 'Lifetime updates'],
    },
  },

  'invoice-os': {
    key: 'invoice-os',
    name: 'Invoice OS',
    category: 'Invoicing',
    icon: 'receipt',
    accent: 'peach',
    ticker: ['INVOICE GENERATOR', 'AGING BUCKETS', 'PAYMENT LOG', 'CLIENT BALANCES', 'GOOGLE SHEETS NATIVE', 'LIFETIME UPDATES'],
    defaultOffer: { offerActive: true, offerLabel: 'Launch Offer', displayOriginalPrice: '$49', displaySalePrice: '$29' },
    meta: {
      title: 'Invoice OS by Runway Systems | Get paid on time',
      description: 'Invoice OS is the Google Sheets invoicing system for freelancers and small teams. Generate, track, and follow up on invoices without another subscription.',
    },
    hero: {
      h1: ['Get paid on time.', 'Without the chase.'],
      lede: 'The complete Google Sheets invoicing system for freelancers and small teams. Generate, track, and follow up on invoices without another subscription.',
      visual: {
        windowTitle: 'Invoice OS / Invoices',
        logo: 'I',
        logoDot: 'OS',
        tabs: ['Invoices', 'Payments', 'Aging', 'Clients'],
        ribbon: [
          { label: 'Outstanding', value: '$12.4k', delta: '3 overdue' },
          { label: 'Paid this month', value: '$8.9k', delta: '+22%' },
          { label: 'On-time payment', value: '96%', delta: 'Healthy' },
        ],
        mock: {
          variant: 'invoice',
          rows: [
            ['INV-1042', 'Globex', '$4,800', 'paid'],
            ['INV-1043', 'Aster Studio', '$1,200', 'sent'],
            ['INV-1044', 'Kepler Co', '$2,900', 'overdue'],
            ['INV-1045', 'Fern & Co', '$650', 'draft'],
          ],
        },
        floating: [
          { icon: 'fileText', tone: '', label: 'Invoice #1042', value: 'Sent', em: '+18%' },
          { icon: 'clock3', tone: 'peach', label: 'Overdue', value: '$1.9k', badge: true },
          { icon: 'badgeCheck', tone: 'blue', label: 'Paid on time', value: '96%', em: 'Stable' },
        ],
        cursorText: 'Updates automatically',
      },
    },
    proof: {
      audience: 'freelancers, creators & small teams',
      stats: [['96%', 'paid on time'], ['0', 'missed invoices'], ['1', 'click to send'], ['$0', 'subscription fees']],
    },
    problem: {
      heading: ['Invoices fall through the cracks', 'Getting paid should not live in five tabs and your head.'],
      intro: 'Invoice OS turns scattered PDFs, reminders, and payment logs into one connected, self-updating view of every invoice.',
      chaos: {
        label: 'Before Invoice OS',
        h3: ['Payments late.', 'Chasing constant.'],
        papers: [['invoice_final_v2.pdf', '?'], ['who_paid_what.xlsx', '#REF!'], ['Follow up on what?', '??'], ['Late fee', '$___']],
        bullets: ['Manual PDFs that go stale', 'Overdue invoices missed', 'No idea what is outstanding'],
      },
      clarity: {
        label: 'With Invoice OS',
        h3: ['One register.', 'A clear next chase.'],
        head: 'Invoice register',
        metrics: [{ label: 'Paid this month', value: 8900, prefix: '$', em: '↗ 22%' }, { label: 'Overdue', value: 1900, prefix: '$', em: '3 invoices' }],
        chartMax: '$12k',
        chartBars: [52, 34, 71, 45, 83, 62, 91, 100],
        bullets: ['Statuses update instantly', 'Overdue invoices surfaced', 'Client balances included'],
      },
    },
    tour: {
      eyebrow: 'An accounts desk in one sheet',
      h2: ['Every invoice connected.', 'Nothing forgotten.'],
      intro: 'Each view feeds the next. Log a payment once and Invoice OS turns it into the balances, aging, and follow-ups you need.',
      items: [
        {
          id: 'generator', number: '01', label: 'Generator', icon: 'fileText',
          title: 'Create a clean, client-ready invoice in clicks.',
          copy: 'Pick a client and an invoice number, then export a polished PDF ready to send.',
          mock: { variant: 'invoice', rows: [['INV-1042', 'Globex', '$4,800', 'paid'], ['INV-1043', 'Aster Studio', '$1,200', 'sent'], ['INV-1044', 'Kepler Co', '$2,900', 'overdue'], ['INV-1045', 'Fern & Co', '$650', 'draft']] },
        },
        {
          id: 'aging', number: '02', label: 'Aging', icon: 'clock3',
          title: 'See exactly what is late and by how much.',
          copy: 'Invoices group into 1-30, 31-60, and 61-90+ day buckets so the chase list writes itself.',
          mock: { variant: 'aging', buckets: [{ label: '1-30 days', value: '$2,400', tone: 'warn' }, { label: '31-60 days', value: '$1,150', tone: 'warn' }, { label: '61-90+ days', value: '$750', tone: 'danger' }] },
        },
        {
          id: 'payments', number: '03', label: 'Payments', icon: 'banknote',
          title: 'Log payments once and stay current.',
          copy: 'Payment dates, amounts, and statuses stay attached to each invoice and client.',
          mock: { variant: 'table', title: 'Payment log', rows: [['INV-1039', 'Northwind', '$2,100', 'paid'], ['INV-1040', 'Brio Works', '$1,500', 'paid'], ['INV-1041', 'Globex', '$4,800', 'paid'], ['INV-1042', 'Kepler Co', '$2,900', 'overdue']] },
        },
        {
          id: 'balances', number: '04', label: 'Balances', icon: 'users',
          title: 'Know every client balance at a glance.',
          copy: 'Outstanding totals per client make it obvious who owes what before you send anything.',
          mock: { variant: 'chart', bars: [{ label: 'Kepler', height: 88, value: '$2.9k' }, { label: 'Aster', height: 58, value: '$1.9k' }, { label: 'Brio', height: 36, value: '$1.2k' }, { label: 'Fern', height: 20, value: '$650' }] },
        },
      ],
    },
    features: {
      eyebrow: 'Built to run the whole collection cycle',
      h2: ['More paid.', 'Far less chasing.'],
      intro: 'From the first draft to the final reminder, every invoicing workflow has a clear home.',
      cards: [
        { icon: 'fileText', title: 'Invoice generator', copy: 'Export a clean, client-ready PDF in a few clicks.', tone: 'peach' },
        { icon: 'clock3', title: 'Aging buckets', copy: 'Group overdue invoices into 1-30, 31-60, and 61-90+ days.', tone: 'blue' },
        { icon: 'banknote', title: 'Payment log', copy: 'Track payment dates, amounts, and statuses per invoice.', tone: 'mint' },
        { icon: 'users', title: 'Client balances', copy: 'See who owes what before you send anything.', tone: 'violet' },
        { icon: 'send', title: 'Chasing templates', copy: 'Ready-made follow-up wording for every aging stage.', tone: 'yellow' },
        { icon: 'badgeCheck', title: 'Tax & discounts', copy: 'Line-level tax and discount support stays on every invoice.', tone: 'lime' },
      ],
      privacy: {
        h3: 'Your invoices stay yours.',
        copy: 'Everything lives inside your private Google Drive. Invoices, clients, and payment data are never sent to us or anyone else.',
        points: ['No external database', 'You control sharing', 'You own your copy'],
      },
    },
    steps: {
      eyebrow: 'From blank sheet to paid invoice',
      h2: ['Set up in minutes.', 'Useful for years.'],
      intro: 'No migration project. No complicated onboarding. No new app to learn.',
      items: [
        { number: '01', icon: 'fileSpreadsheet', title: 'Make your private copy', copy: 'Purchase once and open your own protected copy inside Google Sheets.' },
        { number: '02', icon: 'users', title: 'Add your clients', copy: 'Import client names, emails, and payment terms.' },
        { number: '03', icon: 'fileText', title: 'Generate an invoice', copy: 'Pick the work, the client, and export the PDF.' },
        { number: '04', icon: 'banknote', title: 'Log the payment', copy: 'Your balances and aging update automatically.' },
      ],
      note: {
        title: 'Built exclusively for Google Sheets',
        body: 'Works in your browser and Google Sheets mobile app. Desktop is recommended for initial setup.',
      },
    },
    benefits: {
      heading: 'Spend less time chasing. More time making.',
      copy: 'Invoice OS doesn’t add another layer of process. It removes the repeated work between sending an invoice and knowing where the money is.',
      items: [
        { icon: 'zap', title: 'Move faster', copy: 'Every invoice detail is one glance away.' },
        { icon: 'circleDollarSign', title: 'Protect your cash', copy: 'Overdue amounts and aging stay visible.' },
        { icon: 'trendingUp', title: 'Plan with context', copy: 'See how collections are trending month to month.' },
      ],
      outcome: {
        label: 'Payment confidence',
        gaugeValue: 96,
        gaugeLabel: 'ON TIME',
        stats: [{ label: 'Paid on time', value: 96, suffix: '%' }, { label: 'Overdue', value: 0, decimals: 0 }],
        backOne: { label: 'Paid this month', value: 8900, prefix: '$' },
        backTwo: { label: 'Average days to pay', value: 9, suffix: ' days' },
      },
    },
    audiences: {
      eyebrow: 'Made for people who bill',
      h2: ['The calmer way to collect.'],
      intro: 'Whether you invoice by project, retainer, or hour, Invoice OS gives every payment a clear place.',
      cards: [
        { icon: 'walletCards', role: 'Freelancers', line: 'See what is outstanding and which invoices need a reminder.' },
        { icon: 'sparkles', role: 'Creators', line: 'Keep client balances and payment history in one friendly view.' },
        { icon: 'users', role: 'Small teams', line: 'Turn a shared register into a reliable collection routine.' },
      ],
      note: 'No accounting background required. If you can use a spreadsheet, you can run Invoice OS.',
    },
    pricing: {
      eyebrow: 'One system. One payment.',
      h2: ['Get paid faster for less than one late fee.'],
      intro: 'No subscription. No per-invoice fees. No paying more as you grow.',
      reassurance: ['Secure Lemon Squeezy checkout', 'Instant access after payment', 'Free future updates'],
      included: [
        'Invoice generator with PDF export',
        'Aging buckets & overdue alerts',
        'Payment log & statuses',
        'Client balance overview',
        'Tax & discount support',
        'Chasing email templates',
        'Private Google Sheets copy',
        'All future updates',
      ],
      priceSub: 'Your complete invoicing workspace in Google Sheets.',
      license: 'Personal / single-business license',
      licenseBody: 'Use it for your own business or one you manage.',
    },
    faqs: {
      eyebrow: 'Questions, answered',
      h2: ['Everything you need to know.'],
      items: [
        ['Does Invoice OS send invoices for me?', 'It generates the invoice and a ready-to-send PDF. You send it from your own email so the relationship stays personal.'],
        ['Can I add tax and discounts?', 'Yes. Tax rates and discounts are supported at line level and included in every export.'],
        ['What happens after I buy?', 'Lemon Squeezy securely processes your payment and sends you to a private delivery page with your Google Sheets "Make a Copy" link. You will also receive the link by email as a backup.'],
        ['Is my business data private?', 'Yes. Your copy lives in your Google account and Google Drive. The seller cannot view your invoices, clients, or payment data.'],
        ...SHARED_FAQS.slice(4),
      ],
    },
    finalCta: {
      eyebrow: 'Your clearest collection month starts here',
      h2: ['Stop chasing payments.', 'Start getting paid.'],
      copy: 'One calm system for every invoice that keeps your business moving.',
      small: ['Instant access', 'One-time payment', 'Lifetime updates'],
    },
  },
}

export const DEFAULT_TRUST = TRUST

export function catalogEntry(key) {
  return CATALOG[key] || null
}

// Live-shaped defaults used by the preview adapter and before the public
// config arrives. Operational fields only, no marketing copy.
export function defaultProductConfig(key) {
  const entry = CATALOG[key]
  if (!entry) return null
  return {
    key,
    name: entry.name,
    tagline: entry.hero.lede,
    category: entry.category,
    icon: entry.icon,
    accent: entry.accent,
    originalPrice: entry.defaultOffer.displayOriginalPrice,
    salePrice: entry.defaultOffer.displaySalePrice,
    offerLabel: entry.defaultOffer.offerLabel,
    offerActive: entry.defaultOffer.offerActive,
    active: true,
    featured: key !== 'invoice-os',
    sortOrder: CATALOG_ORDER.indexOf(key),
    includes: [...entry.pricing.included],
    heroImage: '',
    featureImages: [],
    features: [],
    checkoutReady: true,
  }
}

export function defaultProducts() {
  return CATALOG_ORDER.map((key) => defaultProductConfig(key)).filter(Boolean)
}

// Deep-merge admin content over built-in defaults. Arrays and strings from
// the live override replace the defaults when non-empty, so every headline,
// section, and FAQ can be edited from the owner dashboard.
export function mergeContent(base, live = {}) {
  if (!live || typeof live !== 'object') return base
  const merged = Array.isArray(base) ? [...base] : { ...base }
  for (const [key, value] of Object.entries(live)) {
    if (value === undefined || value === null) continue
    const current = merged[key]
    if (Array.isArray(value)) {
      merged[key] = value.length ? value : current
    } else if (typeof value === 'object' && typeof current === 'object' && current !== null && !Array.isArray(current)) {
      merged[key] = mergeContent(current, value)
    } else if (typeof value === 'string') {
      merged[key] = value.trim() ? value : current
    } else {
      merged[key] = value
    }
  }
  return merged
}

export const SUITE_DEFAULTS = {
  hero: {
    h1: ['Calm systems.', 'Busy businesses.'],
    lede: 'A suite of connected Google Sheets products for freelancers, consultants, and small teams. Buy what you need, own it forever, and keep every number in your own Drive.',
  },
  ticker: ['CASH FLOW OS', 'CLIENT CRM OS', 'PROJECT OS', 'INVOICE OS', 'GOOGLE SHEETS NATIVE', 'LIFETIME UPDATES'],
  whyHeading: ['Own your tools.', 'Keep your data.'],
  whyIntro: 'No subscriptions. No lock-in. No one watching your numbers.',
  why: [
    { icon: 'zap', title: 'One-time purchase', copy: 'Pay once and own the product. No subscriptions, no seats, no surprise pricing.' },
    { icon: 'shieldCheck', title: 'Your Drive, your data', copy: 'Every product lives in your private Google Drive. Your numbers never pass through our servers.' },
    { icon: 'layers', title: 'A connected suite', copy: 'Shared conventions across products make your systems feel like one calm toolset.' },
  ],
  faqs: [
    ['How do the products connect?', 'Each product is a self-contained Google Sheets system. Where workflows overlap, such as clients and invoices, the structures share the same conventions so moving data between them is copy and paste.'],
    ['Do I need more than one product?', 'No. Buy only what you need. Many owners start with one product and add another when a second workflow outgrows scattered lists.'],
    ['Are all products Google Sheets only?', 'Yes. Every Runway Systems product is built and tested exclusively for Google Sheets and uses modern functions such as XLOOKUP, MAP, LAMBDA, and BYROW. Do not open them in Excel, Numbers, or LibreOffice.'],
    ['Can I buy two products?', 'Yes. Each purchase is verified separately and appears in your account library with its own private delivery link.'],
    ['Is my business data private?', 'Yes. Your copies live in your Google account and Google Drive. The seller cannot view the data you enter into any product.'],
    ['What is the refund policy?', 'Because these are digital products, purchases are generally non-refundable once accessed. If there is a genuine technical fault and a system does not work as described, contact support and we will make it right.'],
  ],
  bundle: {
    eyebrow: 'COMPLETE SUITE',
    title: 'Get the whole suite in one checkout.',
    body: 'Every product. One payment. Every system in your library.',
  },
  finalCta: {
    eyebrow: 'Your calmest operating year starts here',
    h2: ['Pick a system.', 'Run the business.'],
    copy: 'One-time purchases. Google Sheets native. Built for the way you work.',
    button: 'Browse the suite',
    small: ['One-time payments', 'Instant access', 'Lifetime updates'],
  },
  proof: {
    audience: 'freelancers, consultants, creators & small teams',
    stats: [['4', 'connected products'], ['100%', 'inside your Drive'], ['0', 'monthly fees'], ['1', 'calm place to run things']],
  },
  consent: {
    description: 'Essential storage keeps your cart, theme, and sign-in working. Optional content such as the Trustpilot widget loads only if you accept.',
  },
}

export function buildSuiteViewModel(live = {}) {
  const vm = mergeContent(SUITE_DEFAULTS, live)
  // Flat editor structures map over the default cards so icons are kept.
  if (Array.isArray(vm.whyItems) && vm.whyItems.length) {
    vm.why = vm.why.map((item, index) => {
      const override = vm.whyItems[index]
      return override ? { ...item, title: override.title || item.title, copy: override.copy || item.copy } : item
    })
  }
  if (Array.isArray(vm.faqItems) && vm.faqItems.length) vm.faqs = vm.faqItems
  return vm
}

export function friendlyName(key) {
  return String(key || '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim() || 'Your product'
}

export function fallbackProductConfig(key, live = null) {
  const name = live?.name || friendlyName(key)
  const included = live?.includes?.length ? live.includes : ['Private Google Sheets copy', 'All future updates']
  const tagline = live?.tagline || `A focused Google Sheets tool from ${SUITE_NAME}.`
  const categories = included.slice(0, 3).map((item) => ({ icon: 'check', title: item, copy: `Included with every ${name} purchase.`, tone: 'mint' }))
  return {
    key,
    name,
    category: live?.category || 'Tool',
    icon: live?.icon || 'folder',
    accent: live?.accent || 'lime',
    ticker: [name.toUpperCase(), 'GOOGLE SHEETS NATIVE', 'LIFETIME UPDATES'],
    taglineLive: tagline,
    defaultOffer: {
      offerActive: Boolean(live?.offerActive),
      offerLabel: live?.offerLabel || '',
      displayOriginalPrice: live?.originalPrice || '',
      displaySalePrice: live?.salePrice || '',
    },
    meta: {
      title: `${name} by ${SUITE_NAME}`,
      description: tagline,
    },
    hero: {
      h1: [name, 'Ready when you are.'],
      lede: tagline,
      visual: {
        windowTitle: `${name} / Overview`,
        logo: name.charAt(0),
        logoDot: 'OS',
        tabs: ['Overview', 'Settings', 'Updates'],
        ribbon: [
          { label: 'Included views', value: String(Math.min(included.length, 99)), delta: 'Connected' },
          { label: 'Data lives', value: 'Your Drive', delta: '100%' },
          { label: 'Monthly fees', value: '$0', delta: 'Forever' },
        ],
        mock: {
          variant: 'dashboard',
          metrics: [
            { label: 'Included', value: String(included.length) },
            { label: 'One-time', value: live?.salePrice || 'Owner set' },
            { label: 'Updates', value: 'Lifetime' },
          ],
          bars: [
            { label: included[0] || 'Core', height: 88, value: 'View' },
            { label: included[1] || 'Views', height: 64, value: 'View' },
            { label: included[2] || 'Setup', height: 42, value: 'View' },
          ],
        },
        floating: [
          { icon: 'spreadsheet', tone: '', label: 'Format', value: 'Google Sheets', em: 'Native' },
          { icon: 'folder', tone: 'peach', label: 'Copy', value: 'Private', badge: true },
          { icon: 'shieldCheck', tone: 'blue', label: 'Updates', value: 'Lifetime', em: 'Free' },
        ],
        cursorText: 'Updates automatically',
      },
    },
    proof: {
      audience: 'independent business',
      stats: [['1', 'one-time payment'], ['100%', 'inside your Drive'], ['0', 'monthly fees'], ['1', 'private copy']],
    },
    problem: {
      heading: ['Simple beats scattered', 'Your work should not live in five tabs and your head.'],
      intro: `${name} turns scattered lists into one connected, self-updating system inside your own Google Drive.`,
      chaos: {
        label: `Before ${name}`,
        h3: ['Lists everywhere.', 'Answers nowhere.'],
        papers: [['notes_v3.txt', '?'], ['tracker_final.xlsx', '#REF!'], ['What is next?', '??'], ['Deadlines', '$___']],
        bullets: ['Manual lists that go stale', 'Follow-ups missed', 'No single source of truth'],
      },
      clarity: {
        label: `With ${name}`,
        h3: ['One system.', 'A clear next move.'],
        head: 'Overview',
        metrics: [{ label: 'Connected views', value: Math.min(included.length, 12), em: 'Live' }, { label: 'Monthly fees', value: 0, prefix: '$', em: 'Forever' }],
        chartMax: '100%',
        bullets: ['Updates instantly', 'Connected records', 'Private by design'],
      },
    },
    tour: {
      eyebrow: 'A complete workspace in one sheet',
      h2: ['Everything connected.', 'Nothing complicated.'],
      intro: `Every view speaks to the next. Enter the data once and ${name} turns it into the numbers you need.`,
      items: [
        {
          id: 'overview', number: '01', label: 'Overview', icon: 'layoutDashboard',
          title: 'See the whole picture at a glance.',
          copy: `Core ${name} views stay together in one live command center.`,
          mock: { variant: 'dashboard', metrics: [{ label: 'Included', value: String(included.length) }, { label: 'One-time', value: live?.salePrice || 'Owner set' }, { label: 'Updates', value: 'Lifetime' }], bars: [{ label: included[0] || 'Core', height: 88, value: 'View' }, { label: included[1] || 'Views', height: 64, value: 'View' }, { label: included[2] || 'Setup', height: 42, value: 'View' }] },
        },
        {
          id: 'included', number: '02', label: 'Included', icon: 'check',
          title: 'Know exactly what is inside.',
          copy: 'Every included view is listed on the pricing card so expectations stay clear.',
          mock: { variant: 'table', title: 'Included views', rows: included.slice(0, 4).map((item) => [item, 'Included', 'Yes', 'active']) },
        },
      ],
    },
    features: {
      eyebrow: 'Built to run the whole workflow',
      h2: ['More clarity.', 'Far less admin.'],
      intro: `From the first entry to the final decision, every ${name} workflow has a clear home.`,
      cards: categories.length ? categories : [{ icon: 'folder', title: 'Private workspace', copy: 'Your copy lives in your own Google Drive.', tone: 'mint' }, { icon: 'zap', title: 'Instant access', copy: 'Delivered right after verified payment.', tone: 'peach' }, { icon: 'refreshCw', title: 'Lifetime updates', copy: 'Future improvements arrive in your library.', tone: 'blue' }],
      privacy: {
        h3: 'Your data stays yours.',
        copy: `Everything lives inside your private Google Drive. Your ${name} data is never sent to us or anyone else.`,
        points: ['No external database', 'You control sharing', 'You own your copy'],
      },
    },
    steps: {
      eyebrow: 'From blank to business-ready',
      h2: ['Set up in minutes.', 'Useful for years.'],
      intro: 'No migration project. No complicated onboarding. No new app to learn.',
      items: [
        { number: '01', icon: 'fileSpreadsheet', title: 'Make your private copy', copy: 'Purchase once and open your own protected copy inside Google Sheets.' },
        { number: '02', icon: 'gauge', title: 'Set your preferences', copy: 'Tailor the included views to the way your business works.' },
        { number: '03', icon: 'banknote', title: 'Add your real data', copy: 'Log what matters with simple dropdowns and inputs.' },
        { number: '04', icon: 'barChart3', title: 'Make clearer decisions', copy: 'Your overview and signals update automatically.' },
      ],
      note: {
        title: 'Built exclusively for Google Sheets',
        body: 'Works in your browser and Google Sheets mobile app. Desktop is recommended for initial setup.',
      },
    },
    benefits: {
      heading: 'Spend less time finding information. More time using it.',
      copy: `${name} doesn’t add another layer of process. It removes the repeated work between logging an entry and understanding what it means.`,
      items: [
        { icon: 'zap', title: 'Move faster', copy: 'Your weekly admin becomes a short, repeatable routine.' },
        { icon: 'shieldCheck', title: 'Stay private', copy: 'Your data never leaves your own Drive.' },
        { icon: 'trendingUp', title: 'Plan with context', copy: 'See how today’s entries affect the months ahead.' },
      ],
      outcome: {
        label: 'Daily confidence',
        gaugeValue: 90,
        gaugeLabel: 'CLEAR',
        stats: [{ label: 'Connected views', value: Math.min(included.length, 12) }, { label: 'Monthly fees', value: 0, prefix: '$', decimals: 2 }],
        backOne: { label: 'One-time payment', value: 1 },
        backTwo: { label: 'Updates', value: 100, suffix: '% free' },
      },
    },
    audiences: {
      eyebrow: 'Made for independent business',
      h2: ['The calmer way to stay on top of things.'],
      intro: `Whether you sell your time, retainers, or creative work, ${name} gives everything a clear place.`,
      cards: [
        { icon: 'walletCards', role: 'Freelancers', line: 'See what matters without rebuilding a tracker.' },
        { icon: 'sparkles', role: 'Studios', line: 'Keep every project and client in one connected view.' },
        { icon: 'users', role: 'Small teams', line: 'Turn scattered lists into a shared source of truth.' },
      ],
      note: `No special background required. If you can use a spreadsheet, you can run ${name}.`,
    },
    pricing: {
      eyebrow: 'One system. One payment.',
      h2: ['Own it once. Use it for years.'],
      intro: 'No subscription. No per-user pricing. No paying more as your business grows.',
      reassurance: ['Secure Lemon Squeezy checkout', 'Instant access after payment', 'Free future updates'],
      included,
      priceSub: `Your ${name} workspace in Google Sheets.`,
      license: 'Personal / single-business license',
      licenseBody: 'Use it for your own business or one you manage.',
    },
    faqs: {
      eyebrow: 'Questions, answered',
      h2: ['Everything you need to know.'],
      items: [...SHARED_FAQS],
    },
    finalCta: {
      eyebrow: 'Your clearest operating year starts here',
      h2: ['Stop juggling lists.', 'Start running clearly.'],
      copy: `One calm system for the ${name} work that keeps your business moving.`,
      small: ['Instant access', 'One-time payment', 'Lifetime updates'],
    },
  }
}

// Overlay owner-uploaded screenshots on top of the marketing content. The
// hero image replaces the hero dashboard visual and feature images replace
// tour visuals in order. Extra feature images extend the tour so every
// upload has a home on the page.
function applyUploadedMedia(viewModel, live) {
  if (!live) return viewModel
  const heroImage = typeof live.heroImage === 'string' && live.heroImage ? live.heroImage : ''

  if (heroImage && viewModel.hero?.visual) {
    viewModel.hero.visual = {
      ...viewModel.hero.visual,
      screen: { src: heroImage, alt: `${viewModel.name} dashboard screenshot`, uploaded: true },
    }
  }

  // Feature visuals carry their own AI-scanned (or owner-written) heading,
  // subheading, and order. The storefront renders them in a numbered showcase.
  const featureVisuals = Array.isArray(live.features) ? live.features.filter((feature) => feature && feature.imagePath) : []
  viewModel.featureVisuals = featureVisuals

  return viewModel
}

// Merge the local marketing content with live operational config from the
// platform API. Returns a complete view model for the product page.
export function buildProductViewModel(key, live = null) {
  const entry = CATALOG[key]
  const liveDefaults = live || defaultProductConfig(key)

  // Flat editor lists map onto the structured defaults by index, so icons,
  // screenshots, and ordering survive content edits.
  const applyContentExtras = (vm) => {
    if (Array.isArray(vm.tourItems) && vm.tourItems.length) {
      vm.tour.items = (vm.tour.items || []).map((item, index) => {
        const override = vm.tourItems[index]
        return override ? { ...item, label: override.label || item.label, title: override.title || item.title, copy: override.copy || item.copy } : item
      })
    }
    if (Array.isArray(vm.featuresCards) && vm.featuresCards.length) {
      vm.features.cards = (vm.features.cards || []).map((item, index) => {
        const override = vm.featuresCards[index]
        return override ? { ...item, title: override.title || item.title, copy: override.copy || item.copy } : item
      })
    }
    if (Array.isArray(vm.stepsItems) && vm.stepsItems.length) {
      vm.steps.items = (vm.steps.items || []).map((item, index) => {
        const override = vm.stepsItems[index]
        return override ? { ...item, title: override.title || item.title, copy: override.copy || item.copy } : item
      })
    }
    if (Array.isArray(vm.benefitsItems) && vm.benefitsItems.length) {
      vm.benefits.items = (vm.benefits.items || []).map((item, index) => {
        const override = vm.benefitsItems[index]
        return override ? { ...item, title: override.title || item.title, copy: override.copy || item.copy } : item
      })
    }
    if (Array.isArray(vm.audiencesCards) && vm.audiencesCards.length) {
      vm.audiences.cards = (vm.audiences.cards || []).map((item, index) => {
        const override = vm.audiencesCards[index]
        return override ? { ...item, role: override.role || item.role, line: override.line || item.line } : item
      })
    }
    if (Array.isArray(vm.faqItems) && vm.faqItems.length) vm.faqs.items = vm.faqItems
    if (Array.isArray(vm.pricingIncluded) && vm.pricingIncluded.length) vm.pricing.included = vm.pricingIncluded
    return vm
  }

  if (entry && liveDefaults) {
    // Admin content overrides merge over the built-in marketing copy. The
    // live view model feeds the storefront, so content editing in the owner
    // dashboard changes headlines, sections, FAQs, and CTAs without a deploy.
    const merged = applyContentExtras(mergeContent(entry, liveDefaults.content || {}))
    return applyUploadedMedia({
      ...merged,
      name: liveDefaults.name || entry.name,
      category: liveDefaults.category || entry.category,
      icon: liveDefaults.icon || entry.icon,
      accent: liveDefaults.accent || entry.accent,
      offer: {
        offerActive: typeof liveDefaults.offerActive === 'boolean' ? liveDefaults.offerActive : entry.defaultOffer.offerActive,
        offerLabel: liveDefaults.offerLabel || entry.defaultOffer.offerLabel,
        displayOriginalPrice: liveDefaults.originalPrice || entry.defaultOffer.displayOriginalPrice,
        displaySalePrice: liveDefaults.salePrice || entry.defaultOffer.displaySalePrice,
      },
      pricing: {
        ...merged.pricing,
        included: liveDefaults.includes?.length ? liveDefaults.includes : merged.pricing.included,
      },
      checkoutReady: typeof liveDefaults.checkoutReady === 'boolean' ? liveDefaults.checkoutReady : true,
      taglineLive: liveDefaults.tagline || '',
    }, live)
  }

  if (entry) {
    return {
      ...applyContentExtras(mergeContent(entry, liveDefaults?.content || {})),
      offer: { ...entry.defaultOffer },
      pricing: { ...entry.pricing },
      checkoutReady: true,
      taglineLive: '',
    }
  }

  // Products that only exist in the platform API (owner-created through the
  // admin dashboard) get the generic template. Normalize the offer shape so
  // every page section reads the same view model.
  const fallback = applyContentExtras(mergeContent(fallbackProductConfig(key, live), live?.content || {}))
  return applyUploadedMedia({
    ...fallback,
    offer: { ...fallback.defaultOffer },
    checkoutReady: typeof fallback.checkoutReady === 'boolean' ? fallback.checkoutReady : Boolean(live?.checkoutReady),
  }, live)
}
