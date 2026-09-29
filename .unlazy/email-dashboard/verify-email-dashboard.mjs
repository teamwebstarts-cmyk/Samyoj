import { readFileSync } from 'node:fs';

const dashboard = readFileSync('client/src/pages/DashboardPage.tsx', 'utf8');
const email = readFileSync('client/src/pages/email/EmailDashboardPage.tsx', 'utf8');
const css = readFileSync('client/src/pages/email/email.css', 'utf8');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const meta = dashboard.slice(dashboard.indexOf('const showMetaChannel'), dashboard.indexOf('const showEmail'));
if (!meta.includes("activeChannel === 'facebook'") || !meta.includes("activeChannel === 'instagram'")) {
  fail('meta channel guard is missing');
}
if (meta.includes('email')) fail('email still renders the Instagram or Facebook dashboard');

const hero = email.slice(email.indexOf('ema-hero--dashboard'), email.indexOf('ema-stats'));
if (!hero.includes('Manage templates') || !hero.includes('MetricsPeriodPicker') || !hero.includes('MailGlyph')) {
  fail('hero is missing the shared actions or mail icon');
}
if (/Compose email|Manage connection/i.test(hero)) fail('hero still has a removed action');
if (hero.includes('truncate')) fail('hero description is still cut off');

if (!email.includes('MOCK_STATS.totalSent') || !email.includes('.slice(0, 5)')) {
  fail('dashboard stats or recent list no longer match the approved mock');
}

const actions = css.slice(css.indexOf('.ema-actions {'), css.indexOf('.ema-action {'));
if (!actions.includes('grid-template-columns: minmax(0, 1fr);') || actions.includes('repeat(2')) {
  fail('quick actions are not a single column');
}

const value = css.slice(css.indexOf('.ema-stat__value {'), css.indexOf('.ema-stat__label {'));
const label = css.slice(css.indexOf('.ema-stat__label {'), css.indexOf('.ema-notice {'));
if (!value.includes('display: block;') || !label.includes('display: block;')) {
  fail('stat labels are not under the numbers');
}

const icon = css.slice(css.indexOf('.ema-action__icon {'), css.indexOf('.ema-action__icon svg'));
if (!icon.includes('inline-flex') || !icon.includes('align-items: center;') || !icon.includes('justify-content: center;')) {
  fail('quick action icons are not centered');
}

const heroCss = css.slice(css.indexOf('.ema-hero--dashboard {'), css.indexOf('.ema-hero--dashboard .channel-hero-lead'));
if (heroCss.includes('#e1e9fc') || css.includes('min-height: 148px')) {
  fail('email hero still uses the blue wash or the taller card height');
}

console.log('email dashboard verification passed');
