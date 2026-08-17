/* =====================================================
   سرکار — دفتر کار عراق | منطق رابط کاربری
   کاملاً آفلاین — داده‌ها در localStorage همین دستگاه
   ===================================================== */
(function () {
  'use strict';

  var Jalali = window.Jalali, Core = window.Core;

  /* ----------------------------------------------------
     ثابت‌ها و ابزارها
  ---------------------------------------------------- */
  var JM = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  var GM = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
  var WD = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];

  var DB_KEY = 'sarkar-db-v1';

  var DEFAULTS = {
    settings: { dailyWage: 23.3, otHourly: 2.3, friMultiplier: 2, stayLength: 30, theme: 'auto' },
    trips: [],
    days: {},
    salaries: {},
    debts: []
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function faN(x, dec) {
    if (dec == null) dec = (Math.abs((+x) % 1) > 0.001 ? 1 : 0);
    return (+x).toLocaleString('fa-IR', { maximumFractionDigits: dec });
  }
  function faDigits(x) {
    return String(x).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; });
  }
  function money(x) { return faN(x, 1) + ' هزار دینار'; }
  function moneyShort(x) { return faN(x, 1) + ' هزار'; }
  function dinars(x) { return '≈ ' + Math.round((+x) * 1000).toLocaleString('fa-IR') + ' دینار'; }

  function jOf(iso) { var p = iso.split('-'); return Jalali.toJalaali(+p[0], +p[1], +p[2]); }
  function isoOfJ(jy, jm, jd) { var g = Jalali.toGregorian(jy, jm, jd); return g.gy + '-' + Core.pad(g.gm) + '-' + Core.pad(g.gd); }
  function jStr(iso) { var j = jOf(iso); return faN(j.jd, 0) + ' ' + JM[j.jm - 1] + ' ' + faDigits(j.jy); }
  function jStrShort(iso) { var j = jOf(iso); return faN(j.jd, 0) + ' ' + JM[j.jm - 1]; }
  function gStr(iso) { var p = iso.split('-'); return faN(+p[2], 0) + ' ' + GM[+p[1] - 1] + ' ' + faDigits(p[0]); }
  function wdName(iso) { return WD[Core.weekday(iso)]; }

  var I = {
    pencil: '<svg viewBox="0 0 24 24"><path d="M4.5 19.5l.9-3.6L16.6 4.7a1.9 1.9 0 0 1 2.7 0l0 0a1.9 1.9 0 0 1 0 2.7L8.1 18.6l-3.6.9Z"/><path d="M14.5 6.5l3 3"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4.5 6.5h15"/><path d="M9 6.5V4.5h6v2"/><path d="M6.5 6.5l.9 13h9.2l.9-13"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 5 2.8 20.5h18.4L12 5Z"/><path d="M12 10.5v4M12 17.5h.01"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.75h17M8 3v4M16 3v4"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6.5" width="18" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.3 12h.01M17.7 12h.01"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M7 20v-6M12 20V9.5M17 20v-9"/></svg>',
    plane: '<svg viewBox="0 0 24 24"><path d="M3 13.5 21 4l-6.5 16-2.8-6.2L3 13.5Z"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    chevR: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    chevL: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'
  };

  /* ----------------------------------------------------
     دیتابیس
  ---------------------------------------------------- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      var db = JSON.parse(JSON.stringify(DEFAULTS));
      Object.keys(raw).forEach(function (k) { db[k] = raw[k]; });
      Object.keys(DEFAULTS.settings).forEach(function (k) {
        if (db.settings[k] == null) db.settings[k] = DEFAULTS.settings[k];
      });
      if (!Array.isArray(db.trips)) db.trips = [];
      if (!db.days || typeof db.days !== 'object') db.days = {};
      if (!db.salaries || typeof db.salaries !== 'object') db.salaries = {};
      if (!Array.isArray(db.debts)) db.debts = [];
      return db;
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }
  var DB = load();
  function save() { localStorage.setItem(DB_KEY, JSON.stringify(DB)); }

  var state = {
    page: 'home',
    calJy: null, calJm: null,
    selectedDate: null,
    editTrip: null,
    editDebt: null,
    deferredInstall: null,
    sheetStack: []
  };

  /* ----------------------------------------------------
     محاسبات مشتق
  ---------------------------------------------------- */
  function today() { return Core.todayIso(); }
  function activeTrip() { return Core.activeTrip(DB.trips, today()); }

  function monthKeys() {
    var set = {}, cur = Core.gMonthKey(today());
    Object.keys(DB.days).forEach(function (iso) { set[Core.gMonthKey(iso)] = 1; });
    Object.keys(DB.salaries).forEach(function (k) { set[k] = 1; });
    DB.trips.forEach(function (t) { set[Core.gMonthKey(t.entry)] = 1; });
    set[cur] = 1;
    return Object.keys(set).filter(function (k) { return k <= cur; }).sort().reverse();
  }
  function monthAgg(key) { return Core.aggregate(Core.monthDates(key), DB.days, DB.settings); }
  function monthReceived(key) {
    return (DB.salaries[key] || []).reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
  }
  function monthPaidList(key) { return DB.salaries[key] || []; }

  function weeksAgg(n) {
    var map = {};
    Object.keys(DB.days).forEach(function (iso) {
      var ws = Core.weekStart(iso);
      (map[ws] = map[ws] || []).push(iso);
    });
    return Object.keys(map).sort().reverse().slice(0, n || 8).map(function (k) {
      return { start: k, end: Core.addDays(k, 6), agg: Core.aggregate(map[k], DB.days, DB.settings) };
    });
  }

  function allTime() {
    var agg = Core.aggregate(Object.keys(DB.days), DB.days, DB.settings);
    agg.received = 0;
    Object.keys(DB.salaries).forEach(function (k) { agg.received += monthReceived(k); });
    agg.debt = DB.debts.reduce(function (s, d) { return s + Core.debtRemaining(d); }, 0);
    return agg;
  }

  function jSpanOfGregMonth(key) {
    var a = jOf(Core.gMonthStart(key)), b = jOf(Core.gMonthEnd(key));
    if (a.jy === b.jy && a.jm === b.jm) return JM[a.jm - 1] + ' ' + faDigits(a.jy);
    return jStrShort(Core.gMonthStart(key)) + ' تا ' + jStr(Core.gMonthEnd(key));
  }
  function gMonthName(key) {
    var p = key.split('-');
    return GM[+p[1] - 1] + ' ' + faDigits(p[0]);
  }

  function payChip(received, total) {
    if (!total) return '';
    var r = received / total;
    if (received <= 0) return '<span class="chip red">هنوز نگرفتی</span>';
    if (r >= 0.999) return '<span class="chip green">کامل گرفتی</span>';
    if (r >= 0.9) return '<span class="chip amber">تقریباً کامل</span>';
    if (r >= 0.4 && r <= 0.68) return '<span class="chip blue">نصف</span>';
    if (r >= 0.1 && r <= 0.3) return '<span class="chip orange">۲۰٪</span>';
    return '<span class="chip">جزئی</span>';
  }

  function statusInfo(rec) {
    if (!rec) return { txt: 'ثبت نشده', cls: '' };
    if (rec.status === 'work') return { txt: 'کارکرد', cls: 'green' };
    if (rec.status === 'leave') return { txt: rec.paid ? 'مرخصی با حقوق' : 'مرخصی', cls: 'blue' };
    return { txt: 'کار نکردم', cls: '' };
  }

  /* ----------------------------------------------------
     شیت‌ها، توست، تأیید
  ---------------------------------------------------- */
  function openSheet(html, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    var bz = opts.z || 70, bzb = opts.z ? opts.z - 10 : 60;
    wrap.innerHTML =
      '<div class="sheet-backdrop" style="z-index:' + bzb + '"></div>' +
      '<div class="sheet" style="z-index:' + bz + '" role="dialog">' + html + '</div>';
    document.body.appendChild(wrap);
    var backdrop = wrap.querySelector('.sheet-backdrop');
    var sheet = wrap.querySelector('.sheet');
    requestAnimationFrame(function () { backdrop.classList.add('show'); sheet.classList.add('show'); });
    backdrop.addEventListener('click', function () { closeSheet(); });
    state.sheetStack.push(wrap);
    return wrap;
  }
  function closeSheet() {
    var wrap = state.sheetStack.pop();
    if (!wrap) return;
    var backdrop = wrap.querySelector('.sheet-backdrop');
    var sheet = wrap.querySelector('.sheet');
    backdrop.classList.remove('show');
    sheet.classList.remove('show');
    setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 280);
  }
  function closeAllSheets() { while (state.sheetStack.length) closeSheet(); }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }
  function buzz() { if (navigator.vibrate) { try { navigator.vibrate(14); } catch (e) {} } }

  function askConfirm(msg, yesLabel) {
    return new Promise(function (resolve) {
      var wrap = openSheet(
        '<div class="sheet-grip"></div>' +
        '<h3>' + I.alert + ' ' + esc(msg) + '</h3>' +
        '<div class="sheet-actions">' +
        '<button type="button" class="btn" data-c="no">لغو</button>' +
        '<button type="button" class="btn danger" data-c="yes">' + esc(yesLabel || 'بله، انجام بده') + '</button>' +
        '</div>', { z: 90 }
      );
      wrap.querySelector('[data-c="no"]').addEventListener('click', function () { closeSheet(); resolve(false); });
      wrap.querySelector('[data-c="yes"]').addEventListener('click', function () { closeSheet(); resolve(true); });
    });
  }

  /* ----------------------------------------------------
     نمودار میله‌ای (SVG)
  ---------------------------------------------------- */
  function barChart(items, suffix) {
    if (!items.length) return '<div class="empty">داده‌ای نیست</div>';
    var W = 320, RH = 30, H = items.length * RH + 6;
    var max = Math.max.apply(null, items.map(function (it) { return it.value; })) || 1;
    var rows = items.map(function (it, idx) {
      var y = idx * RH + 4;
      var w = Math.max(3, Math.round((it.value / max) * 190));
      var x = 212 - w;
      var inside = w >= 150;
      var vx = inside ? (x + 6) : Math.max(10, x - 4);
      var anchor = inside ? 'start' : 'end';
      var vcls = inside ? 'v-in' : 'v';
      return '<text x="314" y="' + (y + 13) + '" text-anchor="end">' + esc(it.label) + '</text>' +
        '<rect x="10" y="' + (y + 3) + '" width="202" height="13" rx="6" fill="var(--card2)"></rect>' +
        '<rect x="' + x + '" y="' + (y + 3) + '" width="' + w + '" height="13" rx="6" fill="url(#gradGold' + suffix + ')"></rect>' +
        '<text class="' + vcls + '" x="' + vx + '" y="' + (y + 13) + '" text-anchor="' + anchor + '">' + faN(it.value, 1) + '</text>';
    }).join('');
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMinYMin meet">' +
      '<defs><linearGradient id="gradGold' + suffix + '" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#e09c1f"/><stop offset="1" stop-color="#f5b942"/></linearGradient></defs>' +
      rows + '</svg></div>';
  }

  /* ----------------------------------------------------
     صفحه: خانه
  ---------------------------------------------------- */
  function countdownHTML() {
    var t = today();
    var trip = activeTrip();
    if (!trip) {
      return '<div class="card center" style="border-width:1.5px">' +
        '<div style="font-size:40px">🛂</div>' +
        '<div style="font-weight:800;font-size:16px;margin-bottom:4px">خوش اومدی!</div>' +
        '<p class="muted" style="font-size:13px;margin:0 0 12px">اول، تاریخ ورودت به عراق رو ثبت کن تا شمارش روزها و بقیهٔ حساب‌وکتاب شروع بشه.</p>' +
        '<button type="button" class="btn primary block" data-action="open-trips">' + I.plane + ' ثبت تاریخ ورود</button>' +
        '</div>';
    }
    var s = DB.settings;
    var st = Core.tripStatus(trip, t, s.stayLength);
    var cls, stateTxt, msg, big, unit = 'روز';
    var prog = Math.min(100, Math.round((st.dayNo / st.stayLength) * 100));

    if (st.phase === 'pre') {
      cls = 'cd-ok'; stateTxt = 'قبل از سفر';
      big = Core.diffDays(t, trip.entry); msg = 'هنوز وارد نشدی';
      if (big === 1) msg = 'فردا سفر!';
      prog = 0;
    } else if (st.phase === 'out') {
      cls = 'cd-ok'; stateTxt = 'خارج شدی';
      var end = trip.exit || st.exitDate;
      big = Core.diffDays(trip.entry, end) + 1; unit = 'روز اقامت';
      msg = 'این سفر تموم شده — ' + jStr(trip.entry) + ' تا ' + jStr(end);
      prog = 100;
    } else if (st.phase === 'over') {
      cls = 'cd-danger'; stateTxt = 'موعد گذشته!';
      big = -st.daysLeft; msg = 'از موعد خروج ' + faN(-st.daysLeft, 0) + ' روز گذشته — هرچه زودتر خارج شو یا وضعیت رو به‌روز کن';
    } else if (st.daysLeft === 0) {
      cls = 'cd-danger'; stateTxt = 'روز خروج';
      big = 0; msg = 'امروز روز خروجیه! آمادهٔ برگشت باش 🚨';
    } else if (st.daysLeft === 1) {
      cls = 'cd-danger'; stateTxt = 'آخرین روز';
      big = 1; msg = 'امروز آخرین روز کاریه — فردا باید بری!';
    } else if (st.daysLeft <= 10) {
      cls = 'cd-warn'; stateTxt = 'رو به پایان';
      big = st.daysLeft; msg = 'فقط ' + faN(st.daysLeft, 0) + ' روز تا خروج باقی مونده';
      if (st.daysLeft === 2) msg = 'پس‌فردا روز خروجیته';
    } else {
      cls = 'cd-ok'; stateTxt = 'در حال اقامت';
      big = st.daysLeft; msg = faN(st.daysLeft, 0) + ' روز تا خروج باقی مونده';
    }

    return '<div class="card countdown ' + cls.replace('cd-', 'cd-') + '">' +
      '<div class="row" style="justify-content:space-between;margin-bottom:4px">' +
      '<span class="cd-state ' + cls + '">' + stateTxt + '</span>' +
      '<span class="chip">' + 'روز ' + faN(st.dayNo, 0) + ' از ' + faN(st.stayLength, 0) + '</span>' +
      '</div>' +
      '<div class="cd-big"><span class="cd-num">' + faN(big, 0) + '</span><span class="cd-unit">' + unit + '</span></div>' +
      '<div class="cd-msg">' + msg + '</div>' +
      '<div class="progress"><div style="width:' + prog + '%"></div></div>' +
      '<div class="cd-meta">' +
      '<span>ورود: ' + jStr(trip.entry) + '</span>' +
      '<span>خروج: ' + jStr(st.exitDate) + '</span>' +
      '</div>' +
      '<div class="cd-meta"><span>' + gStr(trip.entry) + '</span><span>' + gStr(st.exitDate) + '</span></div>' +
      '</div>';
  }

  function quickLogHTML() {
    var t = today();
    var rec = DB.days[t];
    var status = rec ? rec.status : 'work';
    var ot = rec && rec.ot ? +rec.ot : 0;
    var paid = rec && rec.paid;
    var note = rec ? (rec.note || '') : '';
    var e = Core.dayEarnings(t, rec || { status: 'work', ot: 0 }, DB.settings);

    return '<div class="card">' +
      '<div class="card-title">' + I.calendar + ' ثبت امروز' +
      '<span class="spacer"></span><span class="chip">' + wdName(t) + (e.fri ? ' • ۲ برابر' : '') + '</span></div>' +
      '<div class="small muted" style="margin-bottom:10px">' + jStr(t) + ' &nbsp;|&nbsp; ' + gStr(t) + '</div>' +
      '<div class="seg" id="q-seg">' +
      '<button type="button" data-action="q-status" data-v="work" class="' + (status === 'work' ? 'selected' : '') + '">کار کردم</button>' +
      '<button type="button" data-action="q-status" data-v="leave" class="' + (status === 'leave' ? 'selected' : '') + '">مرخصی</button>' +
      '<button type="button" data-action="q-status" data-v="off" class="' + (status === 'off' ? 'selected' : '') + '">کار نکردم</button>' +
      '</div>' +
      '<div id="q-paid-row" style="' + (status === 'leave' ? '' : 'display:none') + ';margin-top:9px">' +
      '<button type="button" class="chip ' + (paid ? 'blue' : '') + '" data-action="q-paid">مرخصی با حقوق' + (paid ? ' ✓' : '') + '</button>' +
      '</div>' +
      '<div style="margin-top:12px">' +
      '<div class="small muted center" style="margin-bottom:5px">اضافه‌کاری (ساعت)</div>' +
      '<div class="stepper">' +
      '<button type="button" data-action="q-ot" data-d="-1">' + I.minus + '</button>' +
      '<div class="val"><span id="q-ot-val">' + faN(ot, 1) + '</span><small>ساعت × ' + faN(DB.settings.otHourly, 1) + ' هزار</small></div>' +
      '<button type="button" data-action="q-ot" data-d="1">' + I.plus + '</button>' +
      '</div></div>' +
      '<div class="quick-chips center" id="q-ot-chips">' + [0, 1, 2, 3, 4].map(function (h) {
        return '<span class="chip' + (ot === h ? ' selected' : '') + '" data-action="q-ot-set" data-v="' + h + '">' + faN(h, 0) + '</span>';
      }).join('') + '</div>' +
      '<div class="field" style="margin-top:10px">' +
      '<input class="input" id="q-note" placeholder="یادداشت امروز (اختیاری)…" value="' + esc(note) + '">' +
      '</div>' +
      '<div class="row" style="justify-content:space-between;margin-bottom:12px">' +
      '<span class="muted small">درآمد این روز:</span>' +
      '<b id="q-total" style="color:var(--green)">' + money(rec ? e.total : DB.settings.dailyWage * (e.fri ? DB.settings.friMultiplier : 1)) + '</b>' +
      '</div>' +
      '<button type="button" class="btn primary block" data-action="q-save">' + I.check + (rec ? ' به‌روزرسانی امروز' : ' ثبت امروز') + '</button>' +
      '</div>';
  }

  function qRead() {
    var seg = document.querySelector('#q-seg .selected');
    return {
      status: seg ? seg.getAttribute('data-v') : 'work',
      paid: !!document.querySelector('#q-paid-row .chip.blue'),
      ot: parseFloat(document.getElementById('q-ot-val').textContent.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace('٫', '.')) || 0,
      note: document.getElementById('q-note').value.trim()
    };
  }
  function qRefreshTotal() {
    var d = qRead(); var t = today();
    var e = Core.dayEarnings(t, { status: d.status, paid: d.paid, ot: d.ot }, DB.settings);
    var el = document.getElementById('q-total');
    if (el) el.textContent = money(e.total);
  }

  function homeMonthCard() {
    var key = Core.gMonthKey(today());
    var agg = monthAgg(key);
    var rec = monthReceived(key);
    var rem = agg.total - rec;
    return '<div class="card">' +
      '<div class="card-title">' + I.wallet + ' ' + gMonthName(key) +
      '<span class="spacer"></span><span class="muted small">' + jSpanOfGregMonth(key) + '</span></div>' +
      '<div class="kv"><span class="k">جمع درآمد ماه (' + faN(agg.work, 0) + ' روز کار)</span><span class="v">' + money(agg.total) + '</span></div>' +
      '<div class="kv"><span class="k">دریافت‌شده</span><span class="v" style="color:var(--green)">' + money(rec) + '</span></div>' +
      '<div class="kv ' + (rem > 0.01 ? 'debt-line' : 'total') + '"><span class="k">' + (rem > 0.01 ? 'ماندهٔ دریافتی' : 'کامل گرفته شده ✓') + '</span><span class="v">' + money(Math.max(0, rem)) + '</span></div>' +
      '<div style="margin-top:10px"><button type="button" class="btn sm block" data-action="goto" data-page="salary">جزئیات حقوق ماه‌ها</button></div>' +
      '</div>';
  }

  function renderHome() {
    var t = today();
    var trip = activeTrip();
    var unrec = Core.unrecordedInMonth(Core.gMonthKey(t), DB.days, trip).length;
    var debtTotal = DB.debts.reduce(function (s, d) { return s + Core.debtRemaining(d); }, 0);
    var leaveTotal = Core.aggregate(Object.keys(DB.days), DB.days, DB.settings).leave;

    var html = countdownHTML();

    if (trip && Core.tripStatus(trip, t, DB.settings.stayLength).phase !== 'pre') {
      html += quickLogHTML();
      if (unrec > 0) {
        html += '<div class="warn-box">' + I.alert +
          '<span class="grow">' + faN(unrec, 0) + ' روز این ماه ثبت نشده (بدون ثبت، حقوقش حساب نمی‌شه)</span>' +
          '<button type="button" class="btn sm" data-action="goto" data-page="days">ثبت</button></div>';
      }
      html += homeMonthCard();
    }

    html += '<div class="card">' +
      '<div class="card-title">' + I.chart + ' نمای کلی</div>' +
      '<div class="stat-grid">' +
      '<div class="stat-box"><b>' + moneyShort(allTime().total) + '</b><span>کل درآمد (هزار دینار)</span></div>' +
      '<div class="stat-box"><b style="color:var(--green)">' + moneyShort(allTime().received) + '</b><span>دریافت‌شده</span></div>' +
      '<div class="stat-box"><b style="color:' + (debtTotal > 0 ? 'var(--red)' : 'var(--green)') + '">' + moneyShort(debtTotal) + '</b><span>بدهی باقی‌مانده</span></div>' +
      '<div class="stat-box"><b>' + faN(leaveTotal, 0) + '</b><span>روز مرخصی (کل)</span></div>' +
      '</div></div>';

    html += '<div class="card">' +
      '<div class="card-title">' + I.plane + ' سفرها</div>' +
      (DB.trips.length
        ? DB.trips.slice().sort(function (a, b) { return a.entry < b.entry ? 1 : -1; }).map(function (tr) {
          var isAct = tr === trip;
          return '<div class="item">' +
            '<div class="ic" style="background:var(--card2)">✈️</div>' +
            '<div class="body"><div class="t">' + jStr(tr.entry) + (tr.exit ? ' ← ' + jStr(tr.exit) : ' ← در حال اقامت') +
            (isAct ? ' <span class="chip green">فعال</span>' : '') + '</div>' +
            '<div class="s">' + (tr.exit ? faN(Core.diffDays(tr.entry, tr.exit) + 1, 0) + ' روز' : gStr(tr.entry)) + (tr.note ? ' • ' + esc(tr.note) : '') + '</div></div>' +
            '</div>';
        }).join('')
        : '<div class="empty"><div class="big">✈️</div>هنوز سفری ثبت نشده</div>') +
      '<button type="button" class="btn sm block" data-action="open-trips" style="margin-top:8px">مدیریت سفرها</button>' +
      '</div>';

    return html;
  }

  /* ----------------------------------------------------
     صفحه: روزها (تقویم)
  ---------------------------------------------------- */
  function calMonthHTML() {
    var jy = state.calJy, jm = state.calJm;
    var len = Jalali.jalaaliMonthLength(jy, jm);
    var firstIso = isoOfJ(jy, jm, 1);
    var lastIso = isoOfJ(jy, jm, len);
    var offset = (Core.weekday(firstIso) + 1) % 7; /* شنبه = 0 */
    var t = today();

    var dows = ['شنبه', '۱ش', '۲ش', '۳ش', '۴ش', '۵ش', 'جمعه'].map(function (d, i) {
      return '<div class="cal-dow' + (i === 6 ? ' fri' : '') + '">' + d + '</div>';
    }).join('');

    var cells = '';
    for (var i = 0; i < offset; i++) cells += '<div class="cal-cell empty"></div>';
    for (var d = 1; d <= len; d++) {
      var iso = isoOfJ(jy, jm, d);
      var rec = DB.days[iso];
      var g = iso.split('-')[2];
      var cls = 'cal-cell';
      if (Core.isFriday(iso)) cls += ' fri';
      if (iso > t) cls += ' future';
      if (iso === t) cls += ' today';
      if (iso === state.selectedDate) cls += ' selected';
      var dots = '';
      if (rec) {
        if (rec.status === 'work') dots += '<i class="dot work"></i>';
        else if (rec.status === 'leave') dots += '<i class="dot leave"></i>';
        else dots += '<i class="dot off"></i>';
        if (rec.ot && +rec.ot > 0) dots += '<i class="dot ot"></i>';
        if (rec.note) dots += '<i class="dot note"></i>';
      }
      cells += '<button type="button" class="' + cls + '" data-action="open-day" data-iso="' + iso + '">' +
        '<span class="jd">' + faN(d, 0) + '</span>' +
        '<span class="gd">' + faN(+g, 0) + '</span>' +
        (dots ? '<span class="dots">' + dots + '</span>' : '') +
        '</button>';
    }

    var key = Core.gMonthKey(firstIso);
    var monthAggObj = Core.aggregate([firstIso, lastIso].concat(Object.keys(DB.days).filter(function (iso2) {
      return iso2 >= firstIso && iso2 <= lastIso;
    })), DB.days, DB.settings);

    var unrec = Core.unrecordedInMonth(key, DB.days, activeTrip());
    var unrecCount = unrec.length;

    var html = '<div class="card">' +
      '<div class="cal-head">' +
      '<button type="button" class="nav-arrow" data-action="cal-nav" data-d="-1" title="ماه قبل">' + I.chevR + '</button>' +
      '<div class="cal-title"><div class="j">' + JM[jm - 1] + ' ' + faDigits(jy) + '</div>' +
      '<div class="g">' + gStr(firstIso) + ' تا ' + gStr(lastIso) + '</div></div>' +
      '<button type="button" class="nav-arrow" data-action="cal-nav" data-d="1" title="ماه بعد">' + I.chevL + '</button>' +
      '</div>' +
      '<div class="cal-grid">' + dows + cells + '</div>' +
      '<div class="cal-legend">' +
      '<span><i style="background:var(--green)"></i>کارکرد</span>' +
      '<span><i style="background:var(--blue)"></i>مرخصی</span>' +
      '<span><i style="background:var(--muted)"></i>کار نکردم</span>' +
      '<span><i style="background:var(--orange)"></i>اضافه‌کاری</span>' +
      '<span><i style="background:var(--purple)"></i>یادداشت</span>' +
      '</div>' +
      '<button type="button" class="btn sm block" data-action="cal-today" style="margin-top:10px">برو به ماه جاری</button>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title">' + I.chart + ' خلاصهٔ ' + JM[jm - 1] + ' <span class="spacer"></span><span class="muted small">' + jSpanOfGregMonth(key) + ' میلادی</span></div>' +
      '<div class="month-strip">' +
      '<div class="ms hl"><b>' + faN(monthAggObj.work, 0) + '</b><span>روز کارکرد</span></div>' +
      '<div class="ms"><b>' + faN(monthAggObj.fridays, 0) + '</b><span>جمعهٔ کاری</span></div>' +
      '<div class="ms"><b>' + faN(monthAggObj.ot, 1) + '</b><span>ساعت اضافه‌کاری</span></div>' +
      '<div class="ms hl"><b>' + moneyShort(monthAggObj.total) + '</b><span>جمع (هزار دینار)</span></div>' +
      '<div class="ms"><b>' + faN(monthAggObj.leave, 0) + '</b><span>مرخصی</span></div>' +
      '<div class="ms"><b>' + faN(monthAggObj.off, 0) + '</b><span>کار نکردم</span></div>' +
      '<div class="ms wide"><b>' + moneyShort(monthAggObj.base) + '</b><span>حقوق پایه + اضافه‌کاری ' + moneyShort(monthAggObj.otPay) + '</span></div>' +
      '</div>' +
      (unrecCount > 0
        ? '<div style="margin-top:12px;background:var(--amber-bg);border-radius:13px;padding:10px 12px">' +
        '<div class="small" style="font-weight:700;margin-bottom:7px">' + faN(unrecCount, 0) + ' روز ثبت‌نشده تا امروز — سریع ثبتشون کن:</div>' +
        '<div class="row wrap">' +
        '<select id="bulk-status" class="input" style="width:auto;padding:6px 10px"><option value="work">همه کارکرد</option><option value="leave">همه مرخصی</option><option value="off">همه کار نکردم</option></select>' +
        '<button type="button" class="btn sm primary" data-action="bulk-fill" data-key="' + key + '">ثبت گروهی</button>' +
        '</div></div>'
        : '') +
      '</div>';

    /* لیست روزهای ثبتشدهٔ این ماه */
    var recs = Object.keys(DB.days).filter(function (iso2) { return iso2 >= firstIso && iso2 <= lastIso; }).sort().reverse();
    html += '<div class="card">' +
      '<div class="card-title">' + I.note + ' روزهای ثبت‌شدهٔ ' + JM[jm - 1] + ' (' + faN(recs.length, 0) + ')</div>' +
      (recs.length ? recs.map(function (iso2) { return dayItemHTML(iso2); }).join('') : '<div class="empty">این ماه چیزی ثبت نشده</div>') +
      '</div>';

    return html;
  }

  function dayItemHTML(iso) {
    var rec = DB.days[iso];
    if (!rec) return '';
    var e = Core.dayEarnings(iso, rec, DB.settings);
    var si = statusInfo(rec);
    return '<div class="item">' +
      '<div class="ic" style="' + (si.cls
        ? 'background:var(--' + si.cls + '-bg);color:var(--' + si.cls + ')'
        : 'background:var(--card2);color:var(--muted)') + '">' +
      (rec.status === 'work' ? (e.fri ? '۲×' : '✓') : rec.status === 'leave' ? 'م' : '–') + '</div>' +
      '<div class="body"><div class="t">' + faN(jOf(iso).jd, 0) + ' ' + JM[jOf(iso).jm - 1] +
      ' <span class="chip ' + si.cls + '">' + si.txt + '</span>' +
      (e.ot ? '<span class="chip orange">+' + faN(e.ot, 1) + ' ساعت</span>' : '') + '</div>' +
      '<div class="s">' + wdName(iso) + ' • ' + gStr(iso) + (rec.note ? ' • 📝 ' + esc(rec.note) : '') + '</div></div>' +
      '<div class="amount num">' + moneyShort(e.total) + '</div>' +
      '<div class="item-actions">' +
      '<button type="button" class="mini-btn" data-action="open-day" data-iso="' + iso + '">' + I.pencil + '</button>' +
      '<button type="button" class="mini-btn danger" data-action="del-day" data-iso="' + iso + '">' + I.trash + '</button>' +
      '</div></div>';
  }

  /* شیت ویرایش روز */
  function openDaySheet(iso) {
    var t = today();
    if (iso > t) { toast('تاریخ آینده قابل ثبت نیست'); return; }
    state.selectedDate = iso;
    var rec = DB.days[iso] || { status: 'work', ot: 0, note: '', paid: false };
    var e = Core.dayEarnings(iso, rec, DB.settings);

    openSheet(
      '<div class="sheet-grip"></div>' +
      '<h3>' + I.calendar + ' ' + jStr(iso) +
      '<span class="spacer"></span><span class="chip">' + wdName(iso) + (e.fri ? ' • ۲ برابر' : '') + '</span></h3>' +
      '<div class="small muted" style="margin:-6px 0 12px">' + gStr(iso) + '</div>' +
      '<div class="seg" id="d-seg">' +
      '<button type="button" data-action="d-status" data-v="work" class="' + (rec.status === 'work' ? 'selected' : '') + '">کار کردم</button>' +
      '<button type="button" data-action="d-status" data-v="leave" class="' + (rec.status === 'leave' ? 'selected' : '') + '">مرخصی</button>' +
      '<button type="button" data-action="d-status" data-v="off" class="' + (rec.status === 'off' ? 'selected' : '') + '">کار نکردم</button>' +
      '</div>' +
      '<div id="d-paid-row" style="' + (rec.status === 'leave' ? '' : 'display:none') + ';margin-top:9px">' +
      '<button type="button" class="chip ' + (rec.paid ? 'blue' : '') + '" data-action="d-paid">مرخصی با حقوق' + (rec.paid ? ' ✓' : '') + '</button>' +
      '</div>' +
      '<div style="margin-top:14px">' +
      '<div class="small muted center" style="margin-bottom:5px">اضافه‌کاری (ساعت) — ' + faN(DB.settings.otHourly, 1) + ' هزار در ساعت</div>' +
      '<div class="stepper">' +
      '<button type="button" data-action="d-ot" data-d="-1">' + I.minus + '</button>' +
      '<div class="val"><span id="d-ot-val">' + faN(rec.ot || 0, 1) + '</span><small>ساعت</small></div>' +
      '<button type="button" data-action="d-ot" data-d="1">' + I.plus + '</button>' +
      '</div></div>' +
      '<div class="field" style="margin-top:12px">' +
      '<textarea class="input" id="d-note" placeholder="یادداشت این روز (اختیاری)…">' + esc(rec.note || '') + '</textarea></div>' +
      '<div class="row" style="justify-content:space-between;background:var(--card2);border-radius:12px;padding:9px 13px">' +
      '<span class="muted small">درآمد این روز</span><b id="d-total" style="color:var(--green)">' + money(e.total) + '</b></div>' +
      '<div class="sheet-actions">' +
      (DB.days[iso] ? '<button type="button" class="btn danger" data-action="del-day" data-iso="' + iso + '">' + I.trash + ' حذف</button>' : '') +
      '<button type="button" class="btn primary" data-action="save-day" data-iso="' + iso + '">' + I.check + ' ذخیره</button>' +
      '</div>'
    );
  }

  function dRead() {
    var seg = document.querySelector('#d-seg .selected');
    return {
      status: seg ? seg.getAttribute('data-v') : 'work',
      paid: !!document.querySelector('#d-paid-row .chip.blue'),
      ot: parseFloat(document.getElementById('d-ot-val').textContent.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace('٫', '.')) || 0,
      note: document.getElementById('d-note').value.trim()
    };
  }
  function dRefreshTotal(iso) {
    var d = dRead();
    var e = Core.dayEarnings(iso, d, DB.settings);
    var el = document.getElementById('d-total');
    if (el) el.textContent = money(e.total);
  }

  /* ----------------------------------------------------
     صفحه: آمار
  ---------------------------------------------------- */
  function renderStats() {
    var at = allTime();
    var weeks = weeksAgg(8);
    var months = monthKeys().slice(0, 6);

    var html = '<div class="card">' +
      '<div class="card-title">' + I.chart + ' از اول تا الان</div>' +
      '<div class="stat-grid">' +
      '<div class="stat-box"><b>' + faN(at.work, 0) + '</b><span>روز کارکرد</span></div>' +
      '<div class="stat-box"><b>' + faN(at.fridays, 0) + '</b><span>جمعهٔ کاری (۲ برابر)</span></div>' +
      '<div class="stat-box"><b>' + faN(at.ot, 1) + '</b><span>ساعت اضافه‌کاری</span></div>' +
      '<div class="stat-box"><b>' + faN(at.leave, 0) + '</b><span>روز مرخصی</span></div>' +
      '<div class="stat-box wide"><b style="color:var(--green)">' + money(at.total) + '</b><span>جمع کل درآمد — ' + dinars(at.total) + '</span></div>' +
      '<div class="stat-box"><b style="color:var(--green)">' + moneyShort(at.received) + '</b><span>دریافت‌شده</span></div>' +
      '<div class="stat-box"><b style="color:var(--red)">' + moneyShort(Math.max(0, at.total - at.received)) + '</b><span>ماندهٔ دریافتی</span></div>' +
      '<div class="stat-box"><b style="color:var(--red)">' + moneyShort(at.debt) + '</b><span>بدهی به دیگران</span></div>' +
      '</div></div>';

    /* هفتگی */
    html += '<div class="card">' +
      '<div class="card-title">' + I.chart + ' درآمد هفتگی <span class="spacer"></span><span class="muted small">هفته: شنبه تا جمعه</span></div>' +
      barChart(weeks.map(function (w) { return { label: jStrShort(w.start), value: w.agg.total }; }), 'w') +
      '<table class="tbl"><thead><tr><th>هفته</th><th>روز</th><th>اضافه (ساعت)</th><th class="l">جمع</th></tr></thead><tbody>' +
      weeks.map(function (w) {
        return '<tr><td>' + jStrShort(w.start) + ' تا ' + jStrShort(w.end) + '</td>' +
          '<td>' + faN(w.agg.work, 0) + '</td><td>' + faN(w.agg.ot, 1) + '</td>' +
          '<td class="l sum">' + moneyShort(w.agg.total) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';

    /* ماهانه (میلادی) */
    html += '<div class="card">' +
      '<div class="card-title">' + I.chart + ' درآمد ماهانه <span class="spacer"></span><span class="muted small">حقوق بر اساس ماه میلادی</span></div>' +
      barChart(months.map(function (k) { return { label: GM[+k.split('-')[1] - 1], value: monthAgg(k).total }; }).reverse(), 'm') +
      '<table class="tbl"><thead><tr><th>ماه</th><th>شمسی</th><th>روز</th><th class="l">جمع</th></tr></thead><tbody>' +
      months.map(function (k) {
        var a = monthAgg(k);
        return '<tr><td>' + gMonthName(k) + '</td><td class="small">' + jSpanOfGregMonth(k) + '</td>' +
          '<td>' + faN(a.work, 0) + '</td><td class="l sum">' + moneyShort(a.total) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';

    return html;
  }

  /* ----------------------------------------------------
     صفحه: حقوق
  ---------------------------------------------------- */
  function renderSalary() {
    var keys = monthKeys();
    var html = '<div class="card center" style="padding:12px">' +
      '<div class="small muted">پرداخت‌ها بر اساس ماه میلادی ثبت می‌شه — مثل همون‌طور که اون‌جا پول می‌دن</div></div>';

    keys.forEach(function (key) {
      var a = monthAgg(key);
      var received = monthReceived(key);
      var remaining = a.total - received;
      var pays = monthPaidList(key);
      var unrec = Core.unrecordedInMonth(key, DB.days, activeTrip()).length;

      html += '<div class="card">' +
        '<div class="salary-head"><div><div class="salary-month">' + gMonthName(key) + '</div>' +
        '<div class="salary-jal">' + jSpanOfGregMonth(key) + '</div></div>' + payChip(received, a.total) + '</div>' +
        '<div class="kv"><span class="k">روزهای کارکرد (' + faN(a.fridays, 0) + ' جمعه ×' + faN(DB.settings.friMultiplier, 0) + ')</span><span class="v">' + faN(a.work, 0) + ' روز</span></div>' +
        '<div class="kv"><span class="k">اضافه‌کاری (' + faN(a.ot, 1) + ' ساعت × ' + faN(DB.settings.otHourly, 1) + ')</span><span class="v">' + moneyShort(a.otPay) + '</span></div>' +
        '<div class="kv"><span class="k">حقوق پایه</span><span class="v">' + moneyShort(a.base) + '</span></div>' +
        '<div class="kv total"><span class="k">جمع ماه</span><span class="v">' + money(a.total) + '</span></div>' +
        '<div class="kv"><span class="k">دریافت‌شده</span><span class="v" style="color:var(--green)">' + money(received) + '</span></div>' +
        '<div class="kv ' + (remaining > 0.01 ? 'debt-line' : '') + '"><span class="k">' + (remaining > 0.01 ? 'مانده' : 'وضعیت') + '</span><span class="v">' + (remaining > 0.01 ? money(remaining) : 'کامل گرفته شد ✓') + '</span></div>' +
        (unrec > 0 ? '<div class="note-box">⚠️ ' + faN(unrec, 0) + ' روز این ماه هنوز ثبت نشده — جمع ماه کامل نیست. از صفحهٔ «روزها» ثبتش کن.</div>' : '') +
        (pays.length ? '<div class="pay-list">' + pays.map(function (p) {
          return '<div class="pay-row"><b>' + moneyShort(p.amount) + '</b>' +
            '<span class="when">' + jStr(p.date) + (p.note ? ' • ' + esc(p.note) : '') + '</span>' +
            '<button type="button" class="del" data-action="del-pay" data-key="' + key + '" data-id="' + p.id + '">×</button></div>';
        }).join('') + '</div>' : '') +
        '<div class="pay-form">' +
        '<input class="input num" type="number" inputmode="decimal" step="0.1" min="0" id="pay-' + key + '" placeholder="مبلغ (هزار دینار)">' +
        '<button type="button" class="btn sm" data-action="pay-quick" data-key="' + key + '" data-p="full">کامل</button>' +
        '<button type="button" class="btn sm" data-action="pay-quick" data-key="' + key + '" data-p="half">نصف</button>' +
        '<button type="button" class="btn sm" data-action="pay-quick" data-key="' + key + '" data-p="20">۲۰٪</button>' +
        '<button type="button" class="btn sm primary" data-action="add-pay" data-key="' + key + '">' + I.plus + ' ثبت دریافت</button>' +
        '</div></div>';
    });

    return html;
  }

  /* ----------------------------------------------------
     صفحه: بدهی
  ---------------------------------------------------- */
  function renderDebt() {
    var total = 0, paidAll = 0;
    DB.debts.forEach(function (d) { total += +d.amount; paidAll += (+d.amount - Core.debtRemaining(d)); });
    var remaining = DB.debts.reduce(function (s, d) { return s + Core.debtRemaining(d); }, 0);

    var html = '<div class="card">' +
      '<div class="card-title">' + I.wallet + ' جمع بدهی من</div>' +
      '<div class="stat-grid">' +
      '<div class="stat-box wide"><b style="color:' + (remaining > 0 ? 'var(--red)' : 'var(--green)') + '">' + money(remaining) + '</b><span>بدهی باقی‌مانده — ' + dinars(remaining) + '</span></div>' +
      '<div class="stat-box"><b>' + moneyShort(total) + '</b><span>جمع بدهی‌ها</span></div>' +
      '<div class="stat-box"><b style="color:var(--green)">' + moneyShort(paidAll) + '</b><span>پرداخت‌شده</span></div>' +
      '</div></div>';

    if (!DB.debts.length) {
      html += '<div class="card empty"><div class="big">🤝</div>هیچ بدهی ثبت نشده<br><span class="small">اگه به کسی بدهکار شدی، همین‌جا ثبت کن تا حسابش روشن بمونه</span></div>';
    }

    DB.debts.slice().sort(function (a, b) { return Core.debtRemaining(b) - Core.debtRemaining(a); }).forEach(function (d) {
      var rem = Core.debtRemaining(d);
      var paid = +d.amount - rem;
      var pct = d.amount ? Math.min(100, Math.round((paid / +d.amount) * 100)) : 0;
      html += '<div class="card">' +
        '<div class="item" style="border:none;padding:0 0 8px">' +
        '<div class="ic" style="background:var(--red-bg);color:var(--red)">' + esc((d.person || '؟').trim().charAt(0)) + '</div>' +
        '<div class="body"><div class="t">' + esc(d.person) + (rem <= 0 ? ' <span class="chip green">تسویه شد ✓</span>' : '') + '</div>' +
        '<div class="s">' + faN(+d.amount, 1) + ' هزار دینار' + (d.date ? ' • از ' + jStr(d.date) : '') + (d.note ? ' • ' + esc(d.note) : '') + '</div></div>' +
        '<div class="item-actions">' +
        '<button type="button" class="mini-btn" data-action="edit-debt" data-id="' + d.id + '">' + I.pencil + '</button>' +
        '<button type="button" class="mini-btn danger" data-action="del-debt" data-id="' + d.id + '">' + I.trash + '</button>' +
        '</div></div>' +
        '<div class="progress" style="margin:4px 0 10px"><div style="width:' + pct + '%;background:linear-gradient(90deg,var(--green),#22b784)"></div></div>' +
        '<div class="row small" style="justify-content:space-between;margin-bottom:8px">' +
        '<span class="muted">پرداخت‌شده: <b style="color:var(--green)">' + moneyShort(paid) + '</b></span>' +
        '<span>مانده: <b style="color:var(--red)">' + moneyShort(rem) + '</b></span></div>' +
        ((d.payments || []).map(function (p) {
          return '<div class="pay-row"><b>' + moneyShort(p.amount) + '</b>' +
            '<span class="when">' + jStr(p.date) + (p.note ? ' • ' + esc(p.note) : '') + '</span>' +
            '<button type="button" class="del" data-action="del-pay-debt" data-id="' + d.id + '" data-pid="' + p.id + '">×</button></div>';
        }).join('')) +
        '<div class="pay-form">' +
        '<input class="input num" type="number" inputmode="decimal" step="0.1" min="0" id="dpay-' + d.id + '" placeholder="پرداخت (هزار دینار)">' +
        '<button type="button" class="btn sm primary" data-action="add-pay-debt" data-id="' + d.id + '">' + I.check + ' پرداخت کردم</button>' +
        '</div></div>';
    });

    html += '<button type="button" class="btn primary block" data-action="open-debt-sheet" style="margin-top:4px">' + I.plus + ' بدهی جدید</button>' +
      '<div style="height:14px"></div>';
    return html;
  }

  function openDebtSheet(id) {
    var d = id ? DB.debts.filter(function (x) { return x.id === id; })[0] : null;
    state.editDebt = d;
    openSheet(
      '<div class="sheet-grip"></div>' +
      '<h3>' + I.wallet + (d ? ' ویرایش بدهی' : ' بدهی جدید') + '</h3>' +
      '<div class="field"><label>بدهکار به کی؟</label><input class="input" id="de-person" placeholder="مثلاً: حاج رضا" value="' + esc(d ? d.person : '') + '"></div>' +
      '<div class="field"><label>مبلغ (هزار دینار)</label><input class="input num" type="number" inputmode="decimal" step="0.1" min="0" id="de-amount" placeholder="مثلاً 500" value="' + (d ? (+d.amount) : '') + '"></div>' +
      '<div class="field"><label>تاریخ بدهی</label><input class="input" type="date" id="de-date" value="' + (d && d.date ? d.date : today()) + '">' +
      '<div class="hint">' + jStr(d && d.date ? d.date : today()) + '</div></div>' +
      '<div class="field"><label>یادداشت (اختیاری)</label><input class="input" id="de-note" placeholder="مثلاً: قرض برای کرایه" value="' + esc(d ? d.note || '' : '') + '"></div>' +
      '<div class="sheet-actions">' +
      '<button type="button" class="btn" data-x="close">لغو</button>' +
      '<button type="button" class="btn primary" data-action="save-debt">' + I.check + ' ذخیره</button>' +
      '</div>'
    );
    var dateInp = document.getElementById('de-date');
    dateInp.addEventListener('change', function () {
      this.parentNode.querySelector('.hint').textContent = jStr(this.value || today());
    });
  }

  /* ----------------------------------------------------
     شیت سفرها
  ---------------------------------------------------- */
  function openTripsSheet() {
    var t = today();
    var trip = activeTrip();
    var list = DB.trips.slice().sort(function (a, b) { return a.entry < b.entry ? 1 : -1; }).map(function (tr) {
      var st = Core.tripStatus(tr, t, DB.settings.stayLength);
      var isAct = tr === trip;
      return '<div class="item">' +
        '<div class="ic" style="background:var(--card2)">✈️</div>' +
        '<div class="body"><div class="t">' + jStr(tr.entry) + ' ← ' + (tr.exit ? jStr(tr.exit) : 'در حال اقامت') +
        (isAct ? ' <span class="chip green">فعال</span>' : '') + '</div>' +
        '<div class="s">' + gStr(tr.entry) + ' • موعد خروج: ' + jStr(st.exitDate) + (tr.note ? ' • ' + esc(tr.note) : '') + '</div></div>' +
        '<div class="item-actions">' +
        (!tr.exit && t >= tr.entry && t <= st.exitDate + '' ? '<button type="button" class="mini-btn" title="ثبت خروج امروز" data-action="trip-out" data-id="' + tr.id + '">🛫</button>' : '') +
        '<button type="button" class="mini-btn" data-action="edit-trip" data-id="' + tr.id + '">' + I.pencil + '</button>' +
        '<button type="button" class="mini-btn danger" data-action="del-trip" data-id="' + tr.id + '">' + I.trash + '</button>' +
        '</div></div>';
    }).join('');

    openSheet(
      '<div class="sheet-grip"></div>' +
      '<h3>' + I.plane + ' سفرها / ورود و خروج</h3>' +
      '<div id="trip-list">' + (list || '<div class="empty">سفری ثبت نشده</div>') + '</div>' +
      '<div class="divider"></div>' +
      '<div class="field"><label>تاریخ ورود به عراق</label>' +
      '<input class="input" type="date" id="tr-entry" value="' + (state.editTrip ? state.editTrip.entry : t) + '">' +
      '<div class="hint" id="tr-entry-hint">' + jStr(state.editTrip ? state.editTrip.entry : t) + ' — با تقویم صفحهٔ «روزها» هم می‌تونی انتخاب کنی</div></div>' +
      '<div class="field"><label>تاریخ خروج (اگه خارج شدی)</label>' +
      '<input class="input" type="date" id="tr-exit" value="' + (state.editTrip && state.editTrip.exit ? state.editTrip.exit : '') + '">' +
      '<div class="hint">خالی بذار اگه هنوز داخل عراقی</div></div>' +
      '<div class="field"><label>یادداشت (اختیاری)</label><input class="input" id="tr-note" placeholder="مثلاً: دورهٔ دوم — اربیل" value="' + esc(state.editTrip ? state.editTrip.note || '' : '') + '"></div>' +
      (state.editTrip ? '<button type="button" class="btn sm block" data-action="trip-cancel-edit" style="margin-bottom:8px">لغو ویرایش — سفر جدید ثبت کنم</button>' : '') +
      '<div class="sheet-actions">' +
      '<button type="button" class="btn" data-x="close">بستن</button>' +
      '<button type="button" class="btn primary" data-action="save-trip">' + I.check + (state.editTrip ? ' ذخیرهٔ تغییرات' : ' ثبت سفر') + '</button>' +
      '</div>'
    );
    var entryInp = document.getElementById('tr-entry');
    entryInp.addEventListener('change', function () {
      document.getElementById('tr-entry-hint').textContent = jStr(this.value || today());
    });
  }

  /* ----------------------------------------------------
     شیت تنظیمات
  ---------------------------------------------------- */
  function openSettingsSheet() {
    var s = DB.settings;
    openSheet(
      '<div class="sheet-grip"></div>' +
      '<h3>⚙️ تنظیمات</h3>' +
      '<div class="field"><label>حقوق روزانه (هزار دینار)</label>' +
      '<input class="input num" type="number" inputmode="decimal" step="0.1" min="0" id="st-daily" value="' + s.dailyWage + '">' +
      '<div class="hint">مثلاً 23.3 یعنی ۲۳٬۳۰۰ دینار در روز</div></div>' +
      '<div class="field"><label>اضافه‌کاری هر ساعت (هزار دینار)</label>' +
      '<input class="input num" type="number" inputmode="decimal" step="0.1" min="0" id="st-ot" value="' + s.otHourly + '">' +
      '<div class="hint">جمعه‌ها اضافه‌کاری ۲ برابر نمی‌شه</div></div>' +
      '<div class="field"><label>ضریب حقوق جمعه</label>' +
      '<select class="input" id="st-fri">' +
      [2, 1.5, 3].map(function (m) { return '<option value="' + m + '"' + (+s.friMultiplier === m ? ' selected' : '') + '>×' + faN(m, 1) + (m === 2 ? ' (دو برابر)' : '') + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>مدت اقامت (کل روزها)</label>' +
      '<input class="input num" type="number" inputmode="numeric" step="1" min="2" id="st-stay" value="' + s.stayLength + '">' +
      '<div class="hint">۳۰ یعنی ۲۹ روز بعد از ورود باید خارج بشی (ویزای عراق)</div></div>' +
      '<div class="field"><label>ظاهر</label>' +
      '<select class="input" id="st-theme">' +
      '<option value="auto"' + (s.theme === 'auto' ? ' selected' : '') + '>خودکار (طبق گوشی)</option>' +
      '<option value="dark"' + (s.theme === 'dark' ? ' selected' : '') + '>تیره</option>' +
      '<option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>روشن</option>' +
      '</select></div>' +
      '<div class="divider"></div>' +
      '<button type="button" class="btn block" data-action="open-trips" style="margin-bottom:9px">' + I.plane + ' مدیریت سفرها (ورود/خروج)</button>' +
      '<button type="button" class="btn block" data-action="export" style="margin-bottom:9px">⬇️ خروجی پشتیبان (فایل)</button>' +
      '<button type="button" class="btn block" data-action="import" style="margin-bottom:9px">⬆️ بازیابی از فایل پشتیبان</button>' +
      '<button type="button" class="btn danger block" data-action="reset-all">' + I.trash + ' پاک کردن همهٔ داده‌ها</button>' +
      '<div class="hint center" style="margin-top:14px">سرکار نسخهٔ ۱٫۰ — کاملاً آفلاین؛ همهٔ داده‌ها فقط روی همین گوشی ذخیره می‌شه. هر چند وقت یک‌بار پشتیبان بگیر!</div>' +
      '<input type="file" id="import-file" accept="application/json,.json" hidden>'
    );

    document.getElementById('st-theme').addEventListener('change', function () {
      DB.settings.theme = this.value; save(); applyTheme();
    });
    ['st-daily', 'st-ot', 'st-fri', 'st-stay'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function () {
        var v = parseFloat(this.value);
        if (isNaN(v) || v < 0) v = DEFAULTS.settings[id === 'st-daily' ? 'dailyWage' : id === 'st-ot' ? 'otHourly' : id === 'st-fri' ? 'friMultiplier' : 'stayLength'];
        if (id === 'st-stay') v = Math.max(2, Math.round(v));
        DB.settings[id === 'st-daily' ? 'dailyWage' : id === 'st-ot' ? 'otHourly' : id === 'st-fri' ? 'friMultiplier' : 'stayLength'] = v;
        this.value = v;
        save(); render();
        toast('ذخیره شد ✓');
      });
    });
    document.getElementById('import-file').addEventListener('change', function () {
      var f = this.files[0];
      if (!f) return;
      var reader = new FileReader();
      var self = this;
      reader.onload = async function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object' || !data.settings || !data.days) throw new Error('bad');
          var ok = await askConfirm('فایل پشتیبان جایگزین داده‌های فعلی بشه؟', 'بله، جایگزین کن');
          if (!ok) return;
          localStorage.setItem(DB_KEY, JSON.stringify(data));
          DB = load();
          save();
          closeAllSheets();
          applyTheme();
          render();
          toast('بازیابی شد ✓');
        } catch (e) { toast('فایل معتبر نیست ✗'); }
        self.value = '';
      };
      reader.readAsText(f);
    });
  }

  function applyTheme() {
    var th = DB.settings.theme || 'auto';
    var dark = th === 'dark' || (th === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  /* ----------------------------------------------------
     رندر اصلی
  ---------------------------------------------------- */
  function render() {
    var page = document.getElementById('page');
    if (state.page === 'home') page.innerHTML = renderHome();
    else if (state.page === 'days') page.innerHTML = calMonthHTML();
    else if (state.page === 'stats') page.innerHTML = renderStats();
    else if (state.page === 'salary') page.innerHTML = renderSalary();
    else if (state.page === 'debt') page.innerHTML = renderDebt();

    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-page') === state.page);
    });
  }
  function setPage(p) {
    state.page = p;
    render();
    window.scrollTo({ top: 0 });
  }

  /* ----------------------------------------------------
     اکشن‌ها
  ---------------------------------------------------- */
  var ACTIONS = {
    'goto': function (el) { setPage(el.getAttribute('data-page')); },

    /* ------- نوار بالا ------- */
    'open-settings': function () { openSettingsSheet(); buzz(); },
    'install': function () {
      if (!state.deferredInstall) return;
      state.deferredInstall.prompt();
      state.deferredInstall.userChoice.then(function () {
        state.deferredInstall = null;
        var b = document.getElementById('install-btn');
        if (b) b.hidden = true;
      });
    },

    /* ------- خانه: ثبت سریع ------- */
    'q-status': function (el) {
      document.querySelectorAll('#q-seg button').forEach(function (b) { b.classList.remove('selected'); });
      el.classList.add('selected');
      var row = document.getElementById('q-paid-row');
      if (row) row.style.display = el.getAttribute('data-v') === 'leave' ? '' : 'none';
      qRefreshTotal();
    },
    'q-paid': function (el) { el.classList.toggle('blue'); el.textContent = 'مرخصی با حقوق' + (el.classList.contains('blue') ? ' ✓' : ''); qRefreshTotal(); },
    'q-ot': function (el) {
      var d = parseFloat(el.getAttribute('data-d'));
      var cur = qRead().ot;
      var v = Math.max(0, Math.round((cur + d * 0.5) * 2) / 2);
      setQOt(v); qRefreshTotal(); buzz();
    },
    'q-ot-set': function (el) { setQOt(parseFloat(el.getAttribute('data-v'))); qRefreshTotal(); },
    'q-save': function () {
      var d = qRead();
      DB.days[today()] = { status: d.status, ot: d.ot, note: d.note, paid: d.paid };
      save(); render(); toast('امروز ثبت شد ✓'); buzz();
    },

    /* ------- تقویم ------- */
    'cal-nav': function (el) {
      var d = parseInt(el.getAttribute('data-d'), 10);
      state.calJm += d;
      if (state.calJm > 12) { state.calJm = 1; state.calJy++; }
      if (state.calJm < 1) { state.calJm = 12; state.calJy--; }
      render();
    },
    'cal-today': function () {
      var j = jOf(today());
      state.calJy = j.jy; state.calJm = j.jm;
      render();
    },
    'open-day': function (el) { openDaySheet(el.getAttribute('data-iso')); buzz(); },
    'd-status': function (el) {
      document.querySelectorAll('#d-seg button').forEach(function (b) { b.classList.remove('selected'); });
      el.classList.add('selected');
      var row = document.getElementById('d-paid-row');
      if (row) row.style.display = el.getAttribute('data-v') === 'leave' ? '' : 'none';
      dRefreshTotal(state.selectedDate);
    },
    'd-paid': function (el) { el.classList.toggle('blue'); el.textContent = 'مرخصی با حقوق' + (el.classList.contains('blue') ? ' ✓' : ''); dRefreshTotal(state.selectedDate); },
    'd-ot': function (el) {
      var d = parseFloat(el.getAttribute('data-d'));
      var cur = dRead().ot;
      var v = Math.max(0, Math.round((cur + d * 0.5) * 2) / 2);
      document.getElementById('d-ot-val').textContent = faN(v, 1);
      dRefreshTotal(state.selectedDate); buzz();
    },
    'save-day': function (el) {
      var iso = el.getAttribute('data-iso');
      var d = dRead();
      DB.days[iso] = { status: d.status, ot: d.ot, note: d.note, paid: d.paid };
      save(); closeSheet(); render(); toast('ذخیره شد ✓'); buzz();
    },
    'del-day': async function (el) {
      var iso = el.getAttribute('data-iso');
      if (!DB.days[iso]) return;
      var ok = await askConfirm('روز ' + jStr(iso) + ' حذف بشه؟', 'بله، حذفش کن');
      if (!ok) return;
      delete DB.days[iso];
      save(); closeSheet(); render(); toast('حذف شد'); buzz();
    },
    'bulk-fill': function (el) {
      var key = el.getAttribute('data-key');
      var sel = document.getElementById('bulk-status');
      var status = sel ? sel.value : 'work';
      var unrec = Core.unrecordedInMonth(key, DB.days, activeTrip());
      if (!unrec.length) { toast('چیزی برای ثبت نیست'); return; }
      unrec.forEach(function (iso) { DB.days[iso] = { status: status, ot: 0, note: '', paid: false }; });
      save(); render();
      toast(faN(unrec.length, 0) + ' روز ثبت شد ✓'); buzz();
    },

    /* ------- حقوق ------- */
    'pay-quick': function (el) {
      var key = el.getAttribute('data-key'), p = el.getAttribute('data-p');
      var a = monthAgg(key), received = monthReceived(key);
      var amt = p === 'full' ? Math.max(0, a.total - received) : p === 'half' ? a.total * 0.5 : a.total * 0.2;
      amt = Math.round(amt * 10) / 10;
      document.getElementById('pay-' + key).value = amt;
    },
    'add-pay': function (el) {
      var key = el.getAttribute('data-key');
      var inp = document.getElementById('pay-' + key);
      var amt = parseFloat(inp.value);
      if (isNaN(amt) || amt <= 0) { toast('مبلغ رو وارد کن'); return; }
      if (!DB.salaries[key]) DB.salaries[key] = [];
      DB.salaries[key].push({ id: uid(), amount: amt, date: today(), note: '' });
      save(); render(); toast('دریافت ثبت شد ✓'); buzz();
    },
    'del-pay': async function (el) {
      var key = el.getAttribute('data-key'), id = el.getAttribute('data-id');
      var ok = await askConfirm('این پرداخت حذف بشه؟', 'حذف کن');
      if (!ok) return;
      DB.salaries[key] = (DB.salaries[key] || []).filter(function (p) { return p.id !== id; });
      if (!DB.salaries[key].length) delete DB.salaries[key];
      save(); render(); toast('حذف شد'); buzz();
    },

    /* ------- بدهی ------- */
    'open-debt-sheet': function (el) { openDebtSheet(el && el.getAttribute('data-id')); buzz(); },
    'edit-debt': function (el) { openDebtSheet(el.getAttribute('data-id')); },
    'save-debt': function () {
      var person = document.getElementById('de-person').value.trim();
      var amount = parseFloat(document.getElementById('de-amount').value);
      var date = document.getElementById('de-date').value || today();
      var note = document.getElementById('de-note').value.trim();
      if (!person) { toast('اسم رو بنویس'); return; }
      if (isNaN(amount) || amount <= 0) { toast('مبلغ درست نیست'); return; }
      if (state.editDebt) {
        state.editDebt.person = person; state.editDebt.amount = amount;
        state.editDebt.date = date; state.editDebt.note = note;
      } else {
        DB.debts.push({ id: uid(), person: person, amount: amount, date: date, note: note, payments: [] });
      }
      save(); closeSheet(); render(); toast('ثبت شد ✓'); buzz();
    },
    'del-debt': async function (el) {
      var id = el.getAttribute('data-id');
      var d = DB.debts.filter(function (x) { return x.id === id; })[0];
      if (!d) return;
      var ok = await askConfirm('بدهی «' + d.person + '» کامل حذف بشه؟', 'حذف کامل');
      if (!ok) return;
      DB.debts = DB.debts.filter(function (x) { return x.id !== id; });
      save(); render(); toast('حذف شد'); buzz();
    },
    'add-pay-debt': function (el) {
      var id = el.getAttribute('data-id');
      var d = DB.debts.filter(function (x) { return x.id === id; })[0];
      var inp = document.getElementById('dpay-' + id);
      var amt = parseFloat(inp.value);
      if (!d || isNaN(amt) || amt <= 0) { toast('مبلغ رو وارد کن'); return; }
      d.payments = d.payments || [];
      d.payments.push({ id: uid(), amount: amt, date: today(), note: '' });
      save(); render(); toast('پرداخت ثبت شد ✓'); buzz();
    },
    'del-pay-debt': async function (el) {
      var id = el.getAttribute('data-id'), pid = el.getAttribute('data-pid');
      var ok = await askConfirm('این پرداخت حذف بشه؟', 'حذف کن');
      if (!ok) return;
      var d = DB.debts.filter(function (x) { return x.id === id; })[0];
      if (d) { d.payments = (d.payments || []).filter(function (p) { return p.id !== pid; }); }
      save(); render(); toast('حذف شد'); buzz();
    },

    /* ------- سفرها ------- */
    'open-trips': function () { state.editTrip = null; openTripsSheet(); buzz(); },
    'edit-trip': function (el) {
      state.editTrip = DB.trips.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0] || null;
      closeSheet();
      setTimeout(openTripsSheet, 150);
    },
    'trip-cancel-edit': function () { state.editTrip = null; closeSheet(); setTimeout(openTripsSheet, 150); },
    'save-trip': function () {
      var entry = document.getElementById('tr-entry').value;
      var exit = document.getElementById('tr-exit').value || null;
      var note = document.getElementById('tr-note').value.trim();
      if (!entry) { toast('تاریخ ورود رو انتخاب کن'); return; }
      if (exit && exit < entry) { toast('تاریخ خروج قبل از وروده!'); return; }
      if (state.editTrip) {
        state.editTrip.entry = entry; state.editTrip.exit = exit; state.editTrip.note = note;
      } else {
        DB.trips.push({ id: uid(), entry: entry, exit: exit, note: note });
      }
      save(); closeSheet(); render(); toast('سفر ذخیره شد ✓'); buzz();
    },
    'trip-out': async function (el) {
      var id = el.getAttribute('data-id');
      var tr = DB.trips.filter(function (x) { return x.id === id; })[0];
      if (!tr) return;
      var ok = await askConfirm('خروج امروز (' + jStr(today()) + ') ثبت بشه؟', 'بله، خارج شدم');
      if (!ok) return;
      tr.exit = today();
      save(); closeSheet(); render(); toast('خروج ثبت شد ✓'); buzz();
    },
    'del-trip': async function (el) {
      var id = el.getAttribute('data-id');
      var ok = await askConfirm('این سفر حذف بشه؟ (روزهای ثبت‌شده می‌مونه)', 'حذف کن');
      if (!ok) return;
      DB.trips = DB.trips.filter(function (x) { return x.id !== id; });
      save(); closeSheet(); render(); toast('حذف شد'); buzz();
    },

    /* ------- پشتیبان‌گیری ------- */
    'export': function () {
      var payload = JSON.stringify(DB, null, 2);
      var fname = 'sarkar-backup-' + today() + '.json';
      /* در نسخهٔ اندروید (APK) فایل مستقیم در Downloads ذخیره می‌شه */
      if (window.SarkarAndroid && typeof window.SarkarAndroid.saveFile === 'function') {
        try {
          var b64 = btoa(unescape(encodeURIComponent(payload)));
          var msg = window.SarkarAndroid.saveFile(fname, b64);
          toast(msg || 'ذخیره شد ✓');
        } catch (e) { toast('ذخیرهٔ فایل ممکن نشد ✗'); }
        return;
      }
      try {
        var blob = new Blob([payload], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'sarkar-backup-' + today() + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
        toast('فایل پشتیبان ساخته شد ✓');
      } catch (e) { toast('خطا در ساخت فایل'); }
    },
    'import': function () { document.getElementById('import-file').click(); },
    'reset-all': async function () {
      var ok = await askConfirm('همهٔ داده‌ها برای همیشه پاک بشه؟ قبلش پشتیبان بگیر!', 'پاک کن');
      if (!ok) return;
      localStorage.removeItem(DB_KEY);
      DB = load(); save();
      closeAllSheets();
      applyTheme(); render();
      toast('همه‌چیز پاک شد');
    }
  };

  function setQOt(v) {
    var el = document.getElementById('q-ot-val');
    if (el) el.textContent = faN(v, 1);
    document.querySelectorAll('#q-ot-chips .chip').forEach(function (c) {
      c.classList.toggle('selected', parseFloat(c.getAttribute('data-v')) === v);
    });
  }

  /* ----------------------------------------------------
     رویدادها و شروع
  ---------------------------------------------------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action],[data-x]');
    if (!el) return;
    if (el.hasAttribute('data-x')) {
      if (el.getAttribute('data-x') === 'close') closeSheet();
      return;
    }
    var a = el.getAttribute('data-action');
    if (ACTIONS[a]) { ev.preventDefault(); ACTIONS[a](el, ev); }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeSheet();
  });

  function init() {
    var j = jOf(today());
    state.calJy = j.jy; state.calJm = j.jm;
    applyTheme();
    render();

    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '0.0.0.0')) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      state.deferredInstall = e;
      var b = document.getElementById('install-btn');
      if (b) b.hidden = false;
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if ((DB.settings.theme || 'auto') === 'auto') applyTheme();
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }
  init();

  /* هوک تست/دیباگ (استفادهٔ عادی لازم نیست) */
  window.__sarkar = {
    setPage: setPage,
    render: render,
    get DB() { return DB; },
    today: today
  };
})();
