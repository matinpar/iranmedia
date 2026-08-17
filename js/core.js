/* ------------------------------------------------------------------
 * core.js — منطق محاسباتی خالص (بدون DOM) — قابل تست با Node
 * واحد پول: «هزار دینار عراق» (مثلاً ۲۳٫۳ = ۲۳٬۳۰۰ دینار)
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  /* ---------- ابزار تاریخ (رشتهٔ ISO: YYYY-MM-DD) ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function isoToDate(iso) {
    var p = iso.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }
  function dateToIso(d) { return d.toISOString().slice(0, 10); }
  function todayIso() {
    var n = new Date();
    return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
  }
  function addDays(iso, n) { return dateToIso(new Date(isoToDate(iso).getTime() + n * 86400000)); }
  function diffDays(fromIso, toIso) { return Math.round((isoToDate(toIso) - isoToDate(fromIso)) / 86400000); }
  function weekday(iso) { return isoToDate(iso).getUTCDay(); }   // 0=یکشنبه ... 5=جمعه ... 6=شنبه
  function isFriday(iso) { return weekday(iso) === 5; }
  function gMonthKey(iso) { return iso.slice(0, 7); }
  function gMonthStart(key) { return key + '-01'; }
  function gMonthEnd(key) {
    var p = key.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1], 0));
    return dateToIso(d);
  }
  /* شنبه‌ی همان هفته (هفتهٔ ایرانی: شنبه تا جمعه) */
  function weekStart(iso) { return addDays(iso, -((weekday(iso) + 1) % 7)); }

  /* ---------- درآمد یک روز ---------- */
  /* rec: {status:'work'|'leave'|'off', ot:number, note:string, paid:bool} */
  function dayEarnings(iso, rec, s) {
    var fri = isFriday(iso);
    var ot = rec && rec.ot ? +rec.ot : 0;
    var base = 0;
    if (rec) {
      var working = rec.status === 'work' || (rec.status === 'leave' && rec.paid);
      if (working) base = +s.dailyWage * (fri ? +s.friMultiplier : 1);
    }
    var otPay = ot * +s.otHourly;
    return { base: base, ot: ot, otPay: otPay, total: base + otPay, fri: fri };
  }

  /* ---------- تجمیع بازه‌ای روی روزهای ثبت‌شده ---------- */
  function aggregate(isos, days, s) {
    var a = { work: 0, leave: 0, leavePaid: 0, off: 0, fridays: 0, ot: 0, base: 0, otPay: 0, total: 0 };
    isos.forEach(function (iso) {
      var rec = days[iso];
      if (!rec) return;
      var e = dayEarnings(iso, rec, s);
      if (rec.status === 'work') { a.work++; if (e.fri) a.fridays++; }
      else if (rec.status === 'leave') { a.leave++; if (rec.paid) a.leavePaid++; }
      else a.off++;
      a.ot += e.ot; a.base += e.base; a.otPay += e.otPay; a.total += e.total;
    });
    return a;
  }

  function monthDates(key) {
    var out = [], start = gMonthStart(key), end = gMonthEnd(key);
    for (var d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }

  /* روزهای ثبت‌نشدهٔ قابل ثبت در یک ماه: از max(شروع ماه، ورود سفر) تا min(پایان ماه، امروز، خروج) */
  function unrecordedInMonth(key, days, trip) {
    var start = gMonthStart(key), end = gMonthEnd(key);
    var today = todayIso();
    if (trip && trip.entry > start) start = trip.entry;
    if (end > today) end = today;
    if (trip && trip.exit && end > trip.exit) end = trip.exit;
    var out = [];
    if (end < start) return out;
    for (var d = start; d <= end; d = addDays(d, 1)) if (!days[d]) out.push(d);
    return out;
  }

  /* ---------- وضعیت سفر / شمارش معکوس ---------- */
  function tripStatus(trip, today, stayLength) {
    if (!trip) return null;
    stayLength = +stayLength || 30;
    var exitDate = addDays(trip.entry, stayLength - 1);
    var st = {
      trip: trip,
      exitDate: exitDate,
      stayLength: stayLength,
      daysLeft: diffDays(today, exitDate),   /* مثبت: مانده، 0: امروز، منفی: گذشته */
      dayNo: Math.max(1, diffDays(trip.entry, today) + 1),
      phase: 'in'
    };
    if (today < trip.entry) st.phase = 'pre';
    else if (trip.exit && today > trip.exit) st.phase = 'out';
    else if (today > exitDate) st.phase = 'over';
    return st;
  }

  /* انتخاب سفرِ فعال: آخرین سفر با ورودِ ≤ امروز (بدون خروج)، وگرنه نزدیک‌ترین سفر آینده */
  function activeTrip(trips, today) {
    if (!trips || !trips.length) return null;
    var sorted = trips.slice().sort(function (a, b) { return a.entry < b.entry ? 1 : -1; });
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].entry <= today) return sorted[i];
    }
    return sorted[sorted.length - 1];
  }

  /* ---------- بدهی ---------- */
  function debtRemaining(d) {
    var paid = 0;
    (d.payments || []).forEach(function (p) { paid += +p.amount; });
    return Math.max(0, +d.amount - paid);
  }

  var Core = {
    pad: pad, isoToDate: isoToDate, dateToIso: dateToIso, todayIso: todayIso,
    addDays: addDays, diffDays: diffDays, weekday: weekday, isFriday: isFriday,
    gMonthKey: gMonthKey, gMonthStart: gMonthStart, gMonthEnd: gMonthEnd,
    weekStart: weekStart, dayEarnings: dayEarnings, aggregate: aggregate,
    monthDates: monthDates, unrecordedInMonth: unrecordedInMonth,
    tripStatus: tripStatus, activeTrip: activeTrip, debtRemaining: debtRemaining
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  if (typeof window !== 'undefined') window.Core = Core;
})();
