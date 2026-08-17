/* تست رندر همهٔ صفحات با DOM شبیه‌سازی‌شده (node test/render-test.js) */
'use strict';

function fakeEl() {
  return {
    innerHTML: '', textContent: '', hidden: false, value: '',
    style: {}, files: [],
    classList: {
      _s: {},
      add: function (c) { this._s[c] = 1; },
      remove: function (c) { delete this._s[c]; },
      toggle: function (c, f) { if (f === undefined) f = !this._s[c]; if (f) this._s[c] = 1; else delete this._s[c]; },
      contains: function (c) { return !!this._s[c]; }
    },
    setAttribute: function () {}, getAttribute: function () { return null; },
    addEventListener: function () {}, removeEventListener: function () {},
    appendChild: function () {}, removeChild: function () {}, remove: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    click: function () {}, parentNode: null
  };
}

var els = {};
global.window = global;
global.localStorage = {
  _s: {},
  getItem: function (k) { return (k in this._s) ? this._s[k] : null; },
  setItem: function (k, v) { this._s[k] = String(v); },
  removeItem: function (k) { delete this._s[k]; }
};
global.document = {
  documentElement: fakeEl(),
  body: fakeEl(),
  getElementById: function (id) { if (!els[id]) els[id] = fakeEl(); return els[id]; },
  querySelectorAll: function () { return []; },
  querySelector: function () { return null; },
  createElement: function () { return fakeEl(); },
  addEventListener: function () {}
};
Object.defineProperty(global, 'navigator', { value: { vibrate: function () {} }, configurable: true });
global.requestAnimationFrame = function (fn) { fn(); };
global.scrollTo = function () {};
global.matchMedia = function () { return { matches: false, addEventListener: function () {} }; };
global.addEventListener = function () {};

/* دادهٔ نمونه */
var db = {
  settings: { dailyWage: 23.3, otHourly: 2.3, friMultiplier: 2, stayLength: 30, theme: 'dark' },
  trips: [{ id: 't1', entry: '2026-07-25', exit: null, note: 'اربیل' }],
  days: {
    '2026-07-25': { status: 'work', ot: 2, note: '', paid: false },
    '2026-07-31': { status: 'work', ot: 1, note: 'شیفت شب', paid: false },
    '2026-08-01': { status: 'leave', ot: 0, note: '', paid: false },
    '2026-08-02': { status: 'off', ot: 0, note: 'تعطیل', paid: false },
    '2026-08-05': { status: 'work', ot: 3, note: 'تست', paid: false },
    '2026-08-14': { status: 'work', ot: 0, note: '', paid: false }
  },
  salaries: { '2026-07': [{ id: 'p1', amount: 400, date: '2026-08-01', note: '' }] },
  debts: [{ id: 'd1', person: 'رضا', amount: 500, date: '2026-08-01', note: '', payments: [{ id: 'pp1', amount: 200, date: '2026-08-10' }] }]
};
localStorage.setItem('sarkar-db-v1', JSON.stringify(db));

require('../js/jalali.js');
require('../js/core.js');
require('../js/app.js');

var S = global.window.__sarkar;
var ok = true;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name);
  if (!cond) ok = false;
}

['home', 'days', 'stats', 'salary', 'debt'].forEach(function (p) {
  S.setPage(p);
  var html = els['page'].innerHTML;
  check('صفحهٔ ' + p + ' رندر شد (' + html.length + ' کاراکتر)', html.length > 300);
});

S.setPage('home');
var h = els['page'].innerHTML;
check('شمارش معکوس در خانه', h.indexOf('روز تا خروج') > -1 || h.indexOf('روز خروج') > -1);
check('ثبت امروز در خانه', h.indexOf('ثبت امروز') > -1);
check('تاریخ شمسی در خانه', h.indexOf('مرداد') > -1 || h.indexOf('شهریور') > -1);
check('تاریخ میلادی در خانه', h.indexOf('اوت') > -1);

S.setPage('days');
h = els['page'].innerHTML;
check('تقویم شمسی', h.indexOf('مرداد ۱۴۰۵') > -1);
check('قابلیت ویرایش روز', h.indexOf('data-action="open-day"') > -1);
check('یادداشت روز نمایش داده می‌شه', h.indexOf('تست') > -1);

S.setPage('stats');
h = els['page'].innerHTML;
check('نمودار هفتگی', h.indexOf('درآمد هفتگی') > -1);
check('نمودار ماهانه', h.indexOf('درآمد ماهانه') > -1);

S.setPage('salary');
h = els['page'].innerHTML;
check('ماه میلادی حقوق', h.indexOf('اوت ۲۰۲۶') > -1 || h.indexOf('ژوئیه ۲۰۲۶') > -1);
check('دکمهٔ نصف و ۲۰٪', h.indexOf('نصف') > -1 && h.indexOf('۲۰٪') > -1);

S.setPage('debt');
h = els['page'].innerHTML;
check('بدهی رضا', h.indexOf('رضا') > -1);
check('ماندهٔ بدهی ۳۰۰', h.indexOf('۳۰۰') > -1);

/* محاسبات کلیدی */
var C = global.window.Core;
var agg = C.aggregate(['2026-07-25', '2026-07-31', '2026-08-01', '2026-08-02', '2026-08-05'], db.days, db.settings);
check('روزهای کاری = ۳', agg.work === 3);
check('جمعهٔ کاری = ۱ (۳۱ ژوئیه)', agg.fridays === 1);
check('مرخصی = ۱', agg.leave === 1);
check('اضافه‌کاری ۶ ساعت', Math.abs(agg.ot - 6) < 0.01);
/* پایه: 2 روز عادی×23.3 + جمعه×46.6 = 46.6+46.6=93.2 — مرخصی بی‌حقوق */
check('پایه = 93.2', Math.abs(agg.base - 93.2) < 0.01);
check('اضافه‌کاری = 13.8', Math.abs(agg.otPay - 13.8) < 0.01);
check('جمع کل = 107', Math.abs(agg.total - 107) < 0.01);

console.log(ok ? '\nهمهٔ تست‌ها PASS ✓' : '\nخطا در تست‌ها ✗');
process.exit(ok ? 0 : 1);
