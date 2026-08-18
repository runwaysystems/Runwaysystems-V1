import { Link } from 'react-router-dom'

const cx = (...classes) => classes.filter(Boolean).join(' ')

export function RunwayMark({ className = '' }) {
  return (
    <svg className={cx('runway-mark', className)} viewBox="0 0 80 80" aria-hidden="true">
      {/* The R needs its diagonal leg. Without one, a bowl plus a bare stem
          is literally the letter P, which is how the old mark read next to
          the S. The leg springs from the bowl's lower right and widens as it
          descends to the baseline, so it stays legible at favicon size. */}
      <path className="runway-mark__sheet runway-mark__sheet--r" fillRule="evenodd" d="M9 10h28l15 14v16L43 49l9 21H33l-8-19v19H9V10zm16 14v13h10l4-4v-5l-4-4H25z" />
      <path className="runway-mark__sheet runway-mark__sheet--s" d="M70 10H49L38 21v14l11 9h8l3 3v4l-4 5H40L28 70h32l11-14V40l-11-9h-8l-3-3v-3l4-4h17V10z" />
      <path className="runway-mark__seam" pathLength="1" d="M40 8v64" />
      <path className="runway-mark__spark" d="M40 35l1.5 3.5L45 40l-3.5 1.5L40 45l-1.5-3.5L35 40l3.5-1.5z" />
    </svg>
  )
}

export function Logo({ light = false }) {
  return (
    <Link to="/" className={cx('brand', light && 'brand--light')} aria-label="Runway Systems home">
      <span className="brand-mark"><RunwayMark /></span>
      <span className="brand-name"><b>RUNWAY SYSTEMS</b></span>
    </Link>
  )
}
