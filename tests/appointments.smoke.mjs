// UI checks with synthetic patients; PostgreSQL capacity/concurrency checks live in AppointmentPersistenceTest.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let limit = 1, failBooking = false, failDiary = false;
let patientEmail = 'sipho@example.invalid';
const day = '2030-01-10';
let records = [{ id: 'appointment-1', patientId: 'patient-1', patientName: 'Thandi Mokoena', mpiNumber: 'MPI-001', date: day, time: '09:00:00', startsAt: `${day}T07:00:00Z`, status: 'CONFIRMED', cancelReason: null, notes: null, assignedStaffId: null, assignedStaffName: null, version: 0 }];
const submissions = [];
// The "Appointment with" control is a type-to-filter combobox now, not a
// <select> — click it, type enough of the name to filter to one match, then
// commit with Enter (matches a real user's keyboard flow, not just a click).
async function pickStaff(page, scope, namePart) {
  const combo = scope.getByLabel(/Appointment with/);
  await combo.click();
  await combo.fill(namePart);
  await page.getByRole('option', { name: new RegExp(namePart, 'i') }).first().waitFor();
  await combo.press('Enter');
}
async function session(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const token = `test.${Buffer.from(JSON.stringify({ roles: [role] })).toString('base64url')}.test`;
  await context.addInitScript(token => { sessionStorage.setItem('ulwembu.tenantToken', token); sessionStorage.setItem('ulwembu.tenantSlug', 'appointment-test'); }, token);
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    let json = { items: [] };
    if (path.endsWith('/auth/me')) json = { id: role === 'Doctor' ? 'doctor-1' : 'staff-1', firstName: 'Test', lastName: 'Receptionist', email: 'test@example.invalid' };
    else if (path.endsWith('/auth/session') || path.endsWith('/auth/session/activity')) json = { serverTime: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), idleExpiresAt: new Date(Date.now() + 900000).toISOString(), idleTimeoutSeconds: 900, warningSeconds: 60 };
    else if (path.endsWith('/organization')) json = { displayName: 'Preview Clinic', slug: 'appointment-test' };
    else if (path.endsWith('/facilities')) json = { items: [{ id: 'facility-1', name: 'Main Clinic' }] };
    else if (path.endsWith('/appointment-settings')) json = { items: [{ facilityId: 'facility-1', facilityName: 'Main Clinic', timezone: 'Africa/Johannesburg', dailyLimit: limit }] };
    else if (path.includes('/appointment-settings/')) { limit = route.request().postDataJSON().dailyLimit; json = { facilityId: 'facility-1', facilityName: 'Main Clinic', timezone: 'Africa/Johannesburg', dailyLimit: limit }; }
    else if (path.endsWith('/appointment-staff')) json = { items: [{ id: 'doctor-1', name: 'Lerato Molefe', designation: 'Doctor' }, { id: 'nurse-1', name: 'Nomsa Nkosi', designation: 'Professional Nurse' }] };
    else if (path.endsWith('/patients/search')) json = { items: [{ id: 'patient-2', firstName: 'Sipho', lastName: 'Dlamini', mpiNumber: 'MPI-002', email: patientEmail }] };
    else if (path.endsWith('/reschedule')) { const body = route.request().postDataJSON(); const entry = records.find(a => path.includes(`/${a.id}/`)); Object.assign(entry, { date: body.date, time: body.time, notes: body.notes, assignedStaffId: body.assignedStaffId, assignedStaffName: body.assignedStaffId === 'doctor-1' ? 'Lerato Molefe' : body.assignedStaffId === 'nurse-1' ? 'Nomsa Nkosi' : null, version: entry.version + 1 }); json = entry; }
    else if (path.endsWith('/cancel')) { const body = route.request().postDataJSON(); const entry = records.find(a => path.includes(`/${a.id}/`)); Object.assign(entry, { status: 'CANCELLED', cancelReason: body.reason, version: entry.version + 1 }); json = entry; }
    else if (path.endsWith('/appointments')) {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON(); submissions.push(body);
        if (failBooking) return route.fulfill({ status: 503, json: { message: 'Booking temporarily unavailable. Try again.' } });
        const entry = { id: body.requestId, patientId: body.patientId, patientName: 'Sipho Dlamini', mpiNumber: 'MPI-002', date: body.date, time: body.time, startsAt: `${body.date}T08:00:00Z`, status: 'CONFIRMED', cancelReason: null, notes: body.notes, version: 0, assignedStaffId: body.assignedStaffId, assignedStaffName: body.assignedStaffId === 'doctor-1' ? 'Lerato Molefe' : body.assignedStaffId === 'nurse-1' ? 'Nomsa Nkosi' : null }; records.push(entry); json = entry;
      } else {
        if (failDiary) return route.fulfill({ status: 500, json: { message: 'Diary unavailable' } });
        const date = url.searchParams.get('date') || day, dayItems = records.filter(a => a.date === date), booked = dayItems.filter(a => a.status !== 'CANCELLED').length;
        const items = dayItems.filter(a => (!url.searchParams.get('assignedStaffId') || a.assignedStaffId === url.searchParams.get('assignedStaffId')) && (url.searchParams.get('unassignedOnly') !== 'true' || !a.assignedStaffId) && (!url.searchParams.get('status') || a.status === url.searchParams.get('status')));
        json = { items, totalItems: items.length, hasMore: false, date, timezone: 'Africa/Johannesburg', booked, dailyLimit: limit, remaining: limit === null ? null : Math.max(0, limit - booked), canManage: role !== 'Doctor' };
      }
    }
    await route.fulfill({ json });
  });
  return context;
}
const errors = [];
try {
  const admin = await session('ORG_ADMIN');
  const settings = await admin.newPage();
  settings.on('pageerror', e => errors.push(e.message));
  await settings.goto('http://localhost:5173/app/settings?section=appointments');
  await settings.getByLabel('Daily visit limit', { exact: true }).fill('2');
  await settings.getByRole('button', { name: 'Save limit' }).click();
  await settings.getByText('Daily visit limit saved.', { exact: true }).waitFor();
  assert.equal(limit, 2);
  await settings.reload();
  await settings.getByLabel('Daily visit limit', { exact: true }).waitFor();
  assert.equal(await settings.getByLabel('Daily visit limit', { exact: true }).inputValue(), '2');
  await mkdir('test-results', { recursive: true });
  await settings.screenshot({ path: 'test-results/appointment-settings.png' });
  const reception = await session('Admin Staff');
  const page = await reception.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5173/app/appointments');
  await page.getByText('Thandi Mokoena', { exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Settings', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await page.getByLabel('Find a registered patient').fill('Sipho');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: /Sipho Dlamini/ }).click();
  await page.getByText('sipho@example.invalid', { exact: true }).waitFor();
  await page.getByLabel('Appointment time').fill('10:00');
  await pickStaff(page, page, 'Lerato');
  const staffCombo = page.getByLabel(/Appointment with/);
  // Selecting must not leave a focused combobox that cannot reopen by click.
  await staffCombo.click();
  await page.getByRole('option', { name: 'Unassigned — choose later' }).waitFor();
  await staffCombo.press('Escape');
  assert.match(await staffCombo.inputValue(), /Lerato Molefe/);
  await page.getByLabel('Appointment notes').fill('Follow-up visit.\nBring the previous prescription.');
  failBooking = true;
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await page.getByText('Booking temporarily unavailable. Try again.').waitFor();
  failBooking = false;
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await page.getByText('Daily appointment limit reached (2 of 2)', { exact: true }).waitFor();
  assert.equal(submissions[0].requestId, submissions[1].requestId);
  assert.equal(await page.getByRole('button', { name: 'Book appointment', exact: true }).isEnabled(), true);
  await page.getByText('With Lerato Molefe', { exact: true }).waitFor();
  assert.equal(submissions.at(-1).notes, 'Follow-up visit.\nBring the previous prescription.');
  await page.getByText('Follow-up visit.', { exact: false }).waitFor();
  const staffFilter = page.getByLabel('Assigned to', { exact: true });
  await staffFilter.click();
  await staffFilter.fill('Doctor');
  await staffFilter.press('Enter');
  await page.getByTestId('appointment-row').filter({ hasText: 'Thandi Mokoena' }).waitFor({ state: 'hidden' });
  assert.equal(await page.getByTestId('appointment-row').count(), 1);
  await page.getByText('Daily appointment limit reached (2 of 2)', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByText('Thandi Mokoena', { exact: true }).waitFor();
  await page.screenshot({ path: 'test-results/appointments-desktop.png' });
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await page.getByLabel('Find a registered patient').fill('Sipho');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: /Sipho Dlamini/ }).click();
  await page.getByLabel('Appointment time').fill('11:30');
  await pickStaff(page, page, 'Nomsa');
  await page.getByLabel('Appointment notes').fill('Routine review with the nurse.');
  assert.equal(await page.getByRole('button', { name: 'Confirm booking' }).isDisabled(), true);
  await page.getByLabel('Appointment date').fill('2030-01-13');
  await page.getByText('0 booked · 2 places remaining on 2030-01-13').waitFor();
  await page.screenshot({ path: 'test-results/appointment-booking-date-staff.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/appointment-booking-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await page.getByText('With Nomsa Nkosi', { exact: true }).waitFor();
  assert.equal(submissions.at(-1).date, '2030-01-13');
  assert.equal(submissions.at(-1).time, '11:30');
  assert.equal(submissions.at(-1).assignedStaffId, 'nurse-1');
  assert.equal(await page.getByLabel('Diary date', { exact: true }).inputValue(), '2030-01-13');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Diary date', { exact: true }).fill(day);
  const first = page.getByTestId('appointment-row').filter({ hasText: 'Thandi Mokoena' });
  await first.getByRole('button', { name: 'Cancel', exact: true }).click();
  await first.getByLabel('Cancellation reason').fill('Patient requested cancellation');
  await first.getByRole('button', { name: 'Confirm cancellation' }).click();
  await first.getByText('Cancelled', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Book appointment', exact: true }).isEnabled(), true);
  const second = page.getByTestId('appointment-row').filter({ hasText: 'Sipho Dlamini' });
  await second.getByRole('button', { name: 'Reschedule', exact: true }).click();
  await second.getByLabel('New date').fill('2030-01-11');
  await pickStaff(page, second, 'Nomsa');
  await second.getByLabel('Appointment notes').fill('Updated: bring medication list.');
  await second.getByRole('button', { name: 'Save new time' }).click();
  await page.getByText('Appointment rescheduled.', { exact: true }).waitFor();
  await page.getByLabel('Diary date', { exact: true }).fill('2030-01-11');
  await page.getByText('Sipho Dlamini', { exact: true }).waitFor();
  await page.getByText('Updated: bring medication list.', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/appointments-mobile.png', fullPage: true });
  await page.getByLabel('Diary date', { exact: true }).fill('2030-01-12');
  await page.getByText('No appointments for this date').waitFor();
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await page.getByText('Updated: bring medication list.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await page.getByText('No appointments for this date').waitFor();
  patientEmail = null;
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await page.getByLabel('Find a registered patient').fill('Dlamini');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: /Sipho Dlamini/ }).click();
  await page.getByText('No email saved for this patient.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Close booking form', exact: true }).click();
  const doctor = await session('Doctor');
  const view = await doctor.newPage();
  await view.goto('http://localhost:5173/app/appointments');
  await view.getByText('No appointments for this date').waitFor();
  assert.equal(await view.getByLabel('Assigned to', { exact: true }).inputValue(), 'Lerato Molefe · Doctor');
  await view.getByRole('button', { name: 'Clear filters' }).click();
  await view.getByText('Thandi Mokoena', { exact: true }).waitFor();
  assert.equal(await view.getByRole('button', { name: 'Book appointment', exact: true }).count(), 0);
  assert.equal(await view.getByRole('button', { name: 'Reschedule', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: booking date/time, clinician dropdown and keyboard search/reopen, notes saved and edited, email-on-file/missing email, capacity independent of filters, date navigation, saved limit, receptionist diary, patient search, booking retry ID, full-day block, cancellation, rescheduling, clinician filter default, view-only role and mobile layout.');
} finally { await browser.close(); }
