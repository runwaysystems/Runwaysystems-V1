// Legal page content. The owner can edit every block from the admin panel;
// these are the built-in defaults.
import { mergeContent } from './catalog.js'

export const POLICY_DEFAULTS = {
  intro: 'Plain-language policies for Runway Systems products. Last updated August 14, 2026.',
  sections: [
    {
      id: 'terms',
      number: '01',
      title: 'Terms of use',
      blocks: [
        { h: null, p: 'By purchasing a Runway Systems product, you enter an agreement with Runway Systems and accept these terms. You must provide accurate checkout information, use an account you control, and not attempt to access another buyer\'s entitlement.' },
        { h: 'Purchase, delivery, and account access', p: 'Checkout is processed by Lemon Squeezy. Access is created only after server-side payment verification and is attached to the Supabase account used before checkout. Delivery is provided by transactional email and through the protected account library. You are responsible for maintaining access to the connected email and Google account and for contacting support if delivery does not arrive.' },
        { h: 'Personal or single-business license', p: 'You may use a purchased product for your own business or a business you manage. The license does not extend to reselling, redistributing, or sublicensing the files themselves.' },
        { h: 'No resale or redistribution', p: 'You may not resell, share, or redistribute these templates, in whole or in part, as your own product or as a free download, whether modified or unmodified.' },
        { h: 'No claiming authorship', p: 'You may customize a template for your own use, but you may not present the underlying system, structure, or formulas as your own original creation for resale.' },
        { h: 'No guarantee of fitness', p: 'Templates are provided as-is. While tested for accuracy, you are responsible for verifying your own data and calculations, especially for tax and compliance purposes.' },
        { h: 'Support and updates', p: 'Support covers using the products as intended, including questions about formulas, features, and setup. It does not include custom development or issues caused by using a file outside Google Sheets. Your purchase includes free access to future updates and feature additions.' },
      ],
    },
    {
      id: 'privacy',
      number: '02',
      title: 'Privacy & data protection',
      blocks: [
        { h: null, p: 'This policy explains the personal data Runway Systems processes when you visit this storefront, sign in, purchase a product, receive delivery email, use your account library, or submit feedback. It does not cover the business data you later enter into your own Google Sheets copies.' },
        { h: 'Cookie and storage consent', p: 'Essential storefront storage (your cart, theme, accent palette, intro preference, and sign-in session) stays active without consent because it is required for the site to work, as does anonymous first-party page counting. No optional third-party content is loaded on this site. You can reopen the banner anytime from the Cookie preferences link in the footer to change your choice.' },
        { h: 'Google Sheets product data', p: 'Your product copies are created inside your Google account and stored in Google Drive. Runway Systems does not receive the revenue, client, invoice, project, forecast, or other business data you enter into those copies. You control their Google sharing settings and any access you grant to employees, bookkeepers, or advisers.' },
        { h: 'Google sign-in and Supabase', p: 'Google OAuth is provided through Supabase Authentication. We process your Supabase user identifier and the basic Google profile information returned with your consent, such as name, email address, avatar, and provider metadata. We use it to keep you signed in, attach Lemon Squeezy purchases to the correct account, protect your library, verify feedback eligibility, and enforce owner-only administration. Runway Systems does not receive your Google password. Supabase may store session information in your browser so sign-in persists.' },
        { h: 'Lemon Squeezy payments', p: 'Lemon Squeezy processes checkout and card details under its own privacy terms as the merchant of record. Runway Systems receives the order identifier, email, name, amount, currency, purchased product, payment status, and timestamps needed to grant and revoke access. We do not store full card numbers, CVC values, or raw payment credentials.' },
        { h: 'Cloudflare Worker and D1', p: 'Our Cloudflare Worker validates account tokens, creates Lemon Squeezy checkouts, verifies signed Lemon Squeezy webhooks, and protects delivery actions. Cloudflare D1 stores purchase entitlements, product configuration, delivery and review queue status, testimonial moderation records, private feedback, site settings, webhook idempotency records, aggregate daily page-view and checkout counts, and short-lived rate-limit records. Rate limiting uses a salted identifier rather than displaying your network address in the dashboard.' },
        { h: 'Brevo delivery and review email', p: 'Brevo receives the email address, name when available, subject, and message content needed to send product delivery and review-request email. The private Google Sheets copy link is delivered by email after verified payment and can also be requested from your authenticated account library. Approximately 72 hours after a verified purchase, every buyer receives the same neutral invitation to leave an honest Trustpilot review or send private feedback. Delivery attempts and status are recorded so failed messages can be retried.' },
        { h: 'Trustpilot, feedback, and testimonials', p: 'Trustpilot is an independent service with its own privacy practices. Clicking a Trustpilot link takes you to its website. We do not condition that invitation on your rating. Private feedback is visible only to authorized Runway Systems personnel and is not published. On-site testimonials remain pending until approved. If approved, the submitted name, rating, and text may be shown publicly. You may ask us to remove an approved testimonial.' },
        { h: 'Local storage and essential measurement', p: 'This storefront uses local storage for theme, accent palette, intro-view preference, Supabase authentication persistence, and preview-only interface data when no production API is configured. In production, the Worker records aggregate page paths and checkout starts for basic storefront measurement. We do not describe this as advertising tracking and do not sell personal data.' },
        { h: 'Purpose, disclosure, and retention', p: 'We process data to provide the products and account you request, perform our contract, prevent abuse, support buyers, improve the service, and meet tax, accounting, fraud-prevention, and legal obligations. Data is shared only with service providers needed for those purposes, including Supabase, Google, Lemon Squeezy, Cloudflare, Brevo, and Trustpilot when you choose to visit it. Purchase and transaction records may be retained for the period required by applicable accounting and tax law. Account entitlements are retained while access is provided. Feedback and testimonials are retained until no longer needed or deletion is requested, subject to legal obligations. Expired rate-limit records are routinely deleted.' },
        { h: 'Your choices and requests', p: 'Depending on your location, you may have rights to access, correct, delete, restrict, or export personal data, or object to certain processing. To make a request, withdraw testimonial permission, or ask a privacy question, email {{support}} from the address connected to your account. We may need to verify your identity before completing a request. You can sign out to end the active session and can control Google permissions through your Google account.' },
        { h: 'Deleting your data', p: 'Signed-in users can delete their storefront data directly from the account library. Deletion removes your email and name from purchase and review records, withdraws testimonials from public display, clears private feedback text, cancels pending review emails, and detaches your purchases from your account so library access ends. Aggregate metrics (sales counts, revenue, average ratings) remain as anonymous totals. Deletion does not remove payment records retained by Lemon Squeezy for financial compliance, sent emails retained by Brevo for delivery auditing, or your sign-in record in Supabase; to remove those, email {{support}} from the connected address and we will coordinate the request with the providers.' },
        { h: 'Launch details required', p: 'The support email and public company contact details shown on this site are deployment placeholders until the operator supplies the final values. These must be replaced and this policy reviewed for the operator\'s jurisdiction before accepting live payments.', notice: true },
      ],
    },
    {
      id: 'refunds',
      number: '03',
      title: 'Refund policy',
      blocks: [
        { h: null, p: 'Digital products are generally non-refundable once accessed. If you encounter a genuine technical fault and a system is not working as described, contact {{support}} and we will make it right.' },
      ],
    },
    {
      id: 'warnings',
      number: '04',
      title: 'Important product notices',
      blocks: [
        { h: 'Google Sheets only.', p: 'Runway Systems products use modern Google Sheets functions. Do not download them as Excel, open them in Numbers or LibreOffice, rename tabs, insert columns into existing tables, or overwrite protected formula cells.', notice: true },
        { h: 'Not financial or tax advice.', p: 'Tax reserves are simple estimates based on the rates you enter. These products are business organization tools, not a substitute for an accountant, tax professional, or financial adviser.', notice: true },
      ],
    },
  ],
}

export function buildPoliciesViewModel(live = {}) {
  return mergeContent(POLICY_DEFAULTS, live)
}
