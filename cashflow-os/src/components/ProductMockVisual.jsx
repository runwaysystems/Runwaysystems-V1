import { Check, Clock3, FileText, Layers, ReceiptText } from 'lucide-react'

const cx = (...classes) => classes.filter(Boolean).join(' ')

function MockWindowTop({ title }) {
  return (
    <div className="mock-window-top">
      <div className="window-dots"><i /><i /><i /></div>
      <span className="window-title">{title}</span>
      <span className="live-pill"><i /> LIVE</span>
    </div>
  )
}

function BarPlot({ bars, suffix = '' }) {
  return (
    <div className="product-mock__bars" aria-hidden="true">
      {bars.map((bar) => (
        <div className="product-mock__bar-col" key={bar.label}>
          <small>{bar.value}</small>
          <i><b style={{ height: `${bar.height}%` }} /></i>
          <span>{bar.label}</span>
        </div>
      ))}
    </div>
  )
}

const statusTone = {
  active: 'is-active',
  pending: 'is-pending',
  due: 'is-due',
  paid: 'is-paid',
  sent: 'is-sent',
  overdue: 'is-overdue',
  draft: 'is-draft',
}

function TableMock({ data }) {
  return (
    <div className="product-mock__table">
      <div className="product-mock__table-head" aria-hidden="true"><span>{data.title}</span><b>STATUS</b></div>
      {data.rows.map(([primary, secondary, meta, status], index) => (
        <div className="product-mock__row" key={`${primary}-${index}`}>
          <div><b>{primary}</b><small>{secondary}</small></div>
          <span>{meta}</span>
          <i className={cx('mock-status-pill', statusTone[status] || 'is-active')}>{status}</i>
        </div>
      ))}
    </div>
  )
}

function PipelineMock({ data }) {
  return (
    <div className="product-mock__pipeline">
      {data.columns.map((column) => (
        <div className="product-mock__pipeline-col" key={column.title}>
          <div className="product-mock__pipeline-head"><span>{column.title}</span><b>{column.count}</b></div>
          {column.cards.map((card) => (
            <div className="product-mock__pipeline-card" key={card.t}>
              <b>{card.t}</b>
              <small><Layers size={11} /> {card.tag}</small>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function InvoiceMock({ data }) {
  return (
    <div className="product-mock__invoice" aria-hidden="true">
      <div className="product-mock__invoice-head">
        <span className="product-mock__invoice-mark"><ReceiptText size={16} /></span>
        <div><b>INVOICE</b><small>Runway Systems / Google Sheets</small></div>
      </div>
      <div className="product-mock__invoice-rows">
        {data.rows.map(([number, client, amount, status], index) => (
          <div className="product-mock__row" key={number || index}>
            <div><b>{number}</b><small>{client}</small></div>
            <span>{amount}</span>
            <i className={cx('mock-status-pill', statusTone[status] || 'is-active')}>{status}</i>
          </div>
        ))}
      </div>
      <div className="product-mock__invoice-total"><span>Outstanding total</span><b>$9,550</b></div>
    </div>
  )
}

function AgingMock({ data }) {
  return (
    <div className="product-mock__aging">
      {data.buckets.map((bucket) => (
        <div className={cx('product-mock__aging-row', bucket.tone === 'danger' && 'is-danger')} key={bucket.label}>
          <span className="product-mock__aging-label"><Clock3 size={13} /> {bucket.label}</span>
          <i><b style={{ width: `${Math.min(100, 28 + Number(bucket.value.replace(/[^0-9]/g, '')) / 40)}%` }} /></i>
          <b>{bucket.value}</b>
        </div>
      ))}
    </div>
  )
}

function TimelineMock({ data }) {
  return (
    <div className="product-mock__timeline" aria-hidden="true">
      <i className="product-mock__timeline-line" />
      {data.milestones.map((milestone) => (
        <div
          className={cx('product-mock__timeline-item', milestone.done && 'is-done')}
          key={milestone.label}
          style={{ left: `${milestone.pos}%` }}
        >
          <span>{milestone.done ? <Check size={11} /> : <Clock3 size={11} />}</span>
          <small>{milestone.label}</small>
        </div>
      ))}
    </div>
  )
}

export default function ProductMockVisual({ variant = 'dashboard', data = {}, title = '' }) {
  return (
    <div className={cx('product-mock', `product-mock--${variant}`)}>
      <MockWindowTop title={title} />
      <div className="product-mock__body">
        {variant === 'dashboard' && (
          <>
            <div className="product-mock__metrics">
              {data.metrics.map((metric) => (
                <div key={metric.label}><small>{metric.label}</small><b>{metric.value}</b></div>
              ))}
            </div>
            <BarPlot bars={data.bars} />
          </>
        )}
        {variant === 'chart' && <BarPlot bars={data.bars} />}
        {variant === 'table' && <TableMock data={data} />}
        {variant === 'pipeline' && <PipelineMock data={data} />}
        {variant === 'invoice' && <InvoiceMock data={data} />}
        {variant === 'aging' && <AgingMock data={data} />}
        {variant === 'timeline' && <TimelineMock data={data} />}
      </div>
      <div className="product-mock__footer" aria-hidden="true"><span><FileText size={11} /> Auto-calculated</span><span>Protected formulas</span></div>
    </div>
  )
}
