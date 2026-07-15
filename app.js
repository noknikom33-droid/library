/**
 * ═══════════════════════════════════════════════════════════════
 *  SLS · ระบบห้องสมุดโรงเรียน
 *  File:        app.js — SPA (core + pages) · GitHub Pages edition
 *  Version:     1.1.0
 *  Last Update: 2026-05-17
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 *
 *  รวมจาก ScriptsCore.html + ScriptsPages.html เดิม
 *  จุดที่เปลี่ยน: API client ใช้ fetch() → Apps Script Web App (/exec)
 *  แทน google.script.run (ซึ่งใช้ได้เฉพาะใน iframe ของ Apps Script)
 */

// ═══════════════════════════════════════════════════════════
//  ⚙️ CONFIG — แก้ URL ตรงนี้ที่เดียว (ต้องลงท้ายด้วย /exec)
// ═══════════════════════════════════════════════════════════
var SLS_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwE2PVdmFWeLk09HxABKdIQNpD0eX34jva2nVFxW1CCLINQGJEZVyduzXet_I-AtfjQ7Q/exec'
};

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  //  STORE
  // ═══════════════════════════════════════════════════════════
  var Store = {
    token: '',
    user: null,
    caps: [],
    boot: {}
  };
  try {
    var saved = localStorage.getItem('sls.session');
    if (saved) {
      var s = JSON.parse(saved);
      Store.token = s.token || '';
      Store.user = s.user || null;
      Store.caps = s.caps || [];
    }
  } catch (e) {}

  function saveSession() {
    try {
      localStorage.setItem('sls.session', JSON.stringify({
        token: Store.token, user: Store.user, caps: Store.caps
      }));
    } catch (e) {}
  }
  function clearSession() {
    Store.token = ''; Store.user = null; Store.caps = [];
    try { localStorage.removeItem('sls.session'); } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function hasCap(cap) {
    if (!cap || cap === '*') return true;
    var caps = Store.caps || [];
    return String(cap).split('|').some(function (c) {
      if (c === '*') return true;
      if (caps.indexOf(c) >= 0) return true;
      if (/\.(view_own|edit_own|create_own|cancel_own|view_self)$/.test(c)) return false;
      var dot = c.indexOf('.');
      if (dot > 0) {
        var pref = c.substring(0, dot);
        if (caps.indexOf(pref + '.manage') >= 0) return true;
      }
      return false;
    });
  }
  function canSeeMenu(item) {
    var role = Store.user ? Store.user.role : '';
    if (item.roles && item.roles.indexOf(role) < 0) return false;
    if (item.exclude_roles && item.exclude_roles.indexOf(role) >= 0) return false;
    return hasCap(item.cap);
  }
  function initials(name) {
    var s = String(name || '?').trim();
    if (!s) return '?';
    var parts = s.split(/\s+/);
    return (parts[0].charAt(0) + (parts[1] ? parts[1].charAt(0) : '')).toUpperCase();
  }
  function avatarStyle(url) {
    if (url) return 'background-image:url(' + esc(url) + ');background-size:cover;background-position:center';
    return '';
  }
  function roleLabel(role) {
    var map = (Store.boot && Store.boot.roles) || {};
    return map[role] || role || '';
  }
  function escAttr(s) { return esc(s); }
  function n2(n){ return n<10?'0'+n:''+n; }

  // ═══════════════════════════════════════════════════════════
  //  TH DATE MODULE
  // ═══════════════════════════════════════════════════════════
  var TH = {
    MONTHS: ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'],
    MONTHS_SHORT: ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'],
    WEEKDAYS: ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'],
    WEEKDAYS_SHORT: ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.']
  };
  TH.parse = function (v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    var s = String(v);
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
  };
  TH.beYear = function (d) { return d.getFullYear() + 543; };
  TH.date = function (v) {
    var d = TH.parse(v); if (!d) return v ? v : '-';
    return d.getDate() + ' ' + TH.MONTHS_SHORT[d.getMonth()] + ' ' + TH.beYear(d);
  };
  TH.dateLong = function (v) {
    var d = TH.parse(v); if (!d) return v ? v : '-';
    return d.getDate() + ' ' + TH.MONTHS[d.getMonth()] + ' ' + TH.beYear(d);
  };
  TH.dateWeekday = function (v) {
    var d = TH.parse(v); if (!d) return v ? v : '-';
    return TH.WEEKDAYS_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + TH.MONTHS_SHORT[d.getMonth()] + ' ' + TH.beYear(d);
  };
  TH.dateLongWeekday = function (v) {
    var d = TH.parse(v); if (!d) return v ? v : '-';
    return 'วัน' + TH.WEEKDAYS[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + TH.MONTHS[d.getMonth()] + ' ' + TH.beYear(d);
  };
  TH.time = function (v) {
    var d = TH.parse(v); if (!d) return v ? v : '-';
    return n2(d.getHours()) + ':' + n2(d.getMinutes()) + ' น.';
  };
  TH.timeFull = function (v) {
    var d = TH.parse(v); if (!d) return v ? v : '-';
    return n2(d.getHours()) + ':' + n2(d.getMinutes()) + ':' + n2(d.getSeconds()) + ' น.';
  };
  TH.dateTime = function (v) {
    var d = TH.parse(v); if (!d) return v ? v : '-';
    return TH.date(d) + ' เวลา ' + TH.time(d);
  };
  TH.iso = function (v) {
    var d = TH.parse(v); if (!d) return '';
    return d.getFullYear() + '-' + n2(d.getMonth()+1) + '-' + n2(d.getDate());
  };
  TH.relative = function (v) {
    var d = TH.parse(v); if (!d) return v ? v : '-';
    var diff = Date.now() - d.getTime();
    if (diff < 60000) return 'เมื่อสักครู่';
    if (diff < 3600000) return Math.floor(diff/60000) + ' นาทีที่แล้ว';
    if (diff < 86400000) return Math.floor(diff/3600000) + ' ชั่วโมงที่แล้ว';
    if (diff < 86400000*7) return Math.floor(diff/86400000) + ' วันที่แล้ว';
    return TH.date(d);
  };
  TH.smart = function (v) {
    var d = TH.parse(v); if (!d) return v ? v : '-';
    var diff = Math.abs(Date.now() - d.getTime());
    if (diff < 86400000*7) return TH.relative(d);
    return TH.dateTime(d);
  };
  window.TH = TH;

  // ═══════════════════════════════════════════════════════════
  //  API CLIENT (fetch → Apps Script Web App)
  //  ⚠️ เปลี่ยนจาก google.script.run เป็น fetch(SLS_CONFIG.API_URL)
  //  - ส่งเป็น POST + Content-Type: text/plain (simple request)
  //    เพื่อเลี่ยง CORS preflight ซึ่ง Apps Script ไม่รองรับ
  // ═══════════════════════════════════════════════════════════
  function call(action, payload, timeout) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var to = setTimeout(function () {
        if (!settled) {
          settled = true;
          if (controller) { try { controller.abort(); } catch (e) {} }
          reject(new Error('การเชื่อมต่อหมดเวลา — ' + action));
        }
      }, timeout || 30000);

      if (!SLS_CONFIG.API_URL || SLS_CONFIG.API_URL.indexOf('/exec') < 0) {
        clearTimeout(to);
        return reject(new Error('ยังไม่ได้ตั้งค่า SLS_CONFIG.API_URL (ต้องเป็น URL ของ Web App ที่ลงท้ายด้วย /exec)'));
      }

      var opts = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: Store.token, payload: payload || {} }),
        redirect: 'follow'
      };
      if (controller) opts.signal = controller.signal;

      fetch(SLS_CONFIG.API_URL, opts)
        .then(function (r) {
          if (!r.ok) throw new Error('เซิร์ฟเวอร์ตอบกลับ HTTP ' + r.status);
          return r.json();
        })
        .then(function (res) {
          if (settled) return; settled = true; clearTimeout(to);
          if (!res) return reject(new Error('ไม่ได้รับคำตอบจากเซิร์ฟเวอร์'));
          if (res.ok) resolve(res.data); else reject(new Error(res.error || 'เกิดข้อผิดพลาด'));
        })
        .catch(function (e) {
          if (settled) return; settled = true; clearTimeout(to);
          if (e && e.name === 'AbortError') {
            reject(new Error('การเชื่อมต่อหมดเวลา — ' + action));
          } else if (e && /Failed to fetch|NetworkError|Load failed/i.test(e.message || '')) {
            reject(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบว่า Deploy Web App เป็น "Anyone" และ URL ถูกต้อง'));
          } else {
            reject(new Error(e && e.message ? e.message : String(e)));
          }
        });
    });
  }
  window.call = call;

  // ═══════════════════════════════════════════════════════════
  //  TOAST / MODAL / SPINNER
  // ═══════════════════════════════════════════════════════════
  function toast(msg, type, dur) {
    type = type || 'info';
    dur = dur || (type === 'error' ? 4500 : 2800);
    var host = $('#toast-host');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    var icon = { success:'check-circle-fill', error:'exclamation-triangle-fill', warning:'exclamation-circle-fill', info:'info-circle-fill' }[type] || 'info-circle-fill';
    el.innerHTML = '<i class="bi bi-' + icon + ' ti"></i><div class="tx">' + esc(msg) + '</div><i class="bi bi-x tc"></i>';
    host.appendChild(el);
    var close = function () {
      el.classList.add('dismiss');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    };
    el.querySelector('.tc').addEventListener('click', close);
    setTimeout(close, dur);
  }
  function alertSuccess(title, msg) {
    return Swal.fire({
      icon: 'success', title: title || 'สำเร็จ',
      html: msg ? esc(msg) : '',
      timer: 2200, showConfirmButton: false, timerProgressBar: true,
      showClass: { popup: 'animate__animated animate__zoomIn animate__faster' }
    });
  }
  function alertError(title, msg) {
    return Swal.fire({
      icon: 'error', title: title || 'เกิดข้อผิดพลาด',
      html: esc(msg || ''),
      confirmButtonText: 'ตกลง',
      showClass: { popup: 'animate__animated animate__shakeX animate__faster' }
    });
  }
  function alertInfo(title, msg) {
    return Swal.fire({ icon: 'info', title: title || 'แจ้งเตือน', html: esc(msg || ''), confirmButtonText: 'ตกลง' });
  }
  function confirmModal(opts) {
    opts = opts || {};
    return Swal.fire({
      title: opts.title || 'ยืนยันการกระทำ',
      html: esc(opts.message || ''),
      icon: opts.icon || 'question',
      showCancelButton: true,
      confirmButtonText: opts.okText || 'ยืนยัน',
      cancelButtonText: opts.cancelText || 'ยกเลิก',
      reverseButtons: true,
      confirmButtonColor: opts.danger ? '#ef4444' : undefined
    }).then(function (r) { return r.isConfirmed; });
  }
  function promptModal(opts) {
    opts = opts || {};
    return Swal.fire({
      title: opts.title || 'กรอกข้อมูล',
      html: esc(opts.message || ''),
      input: opts.inputType || 'text',
      inputValue: opts.value || '',
      inputPlaceholder: opts.placeholder || '',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true,
      inputValidator: function (v) {
        if (opts.required && !v) return 'กรุณากรอกข้อมูล';
        return undefined;
      }
    }).then(function (r) { return r.isConfirmed ? r.value : null; });
  }
  var Spinner = (function () {
    var timer = null, stages = [], idx = 0;
    function show(msg, opts) {
      opts = opts || {};
      var ov = $('#spinner-overlay');
      if (!ov) return;
      $('#spn-text').textContent = msg || 'กำลังประมวลผล...';
      stages = opts.stages || [];
      idx = 0;
      $('#spn-stages').textContent = stages[0] || '';
      if (timer) clearInterval(timer);
      if (stages.length > 1) {
        timer = setInterval(function () {
          idx = (idx + 1) % stages.length;
          $('#spn-stages').textContent = stages[idx];
        }, opts.stageInterval || 900);
      }
      ov.hidden = false;
    }
    function update(msg) { if ($('#spn-text')) $('#spn-text').textContent = msg; }
    function hide() {
      if (timer) { clearInterval(timer); timer = null; }
      var ov = $('#spinner-overlay');
      if (ov) ov.hidden = true;
    }
    return { show: show, hide: hide, update: update };
  })();
  var Modal = {
    open: function (opts) {
      opts = opts || {};
      var host = $('#modal-host');
      if (!host) return;
      var titleHtml = '';
      if (opts.title) {
        titleHtml = '<div class="md-header"><div class="md-title">'
          + (opts.titleIcon ? '<i class="bi ' + esc(opts.titleIcon) + '"></i>' : '')
          + esc(opts.title) + '</div>'
          + '<button class="md-close" data-modal-close type="button"><i class="bi bi-x-lg"></i></button></div>';
      }
      var html = '<div class="modal-card' + (opts.large ? ' large' : '') + '">'
        + titleHtml
        + '<div class="md-body">' + (opts.html || '') + '</div>'
        + (opts.footer ? '<div class="md-footer">' + opts.footer + '</div>' : '')
        + '</div>';
      host.innerHTML = html;
      host.classList.add('is-open');
      // Delegation: close on data-modal-close OR backdrop click
      var onClick = function (e) {
        if (e.target === host) { Modal.close(); return; }
        var c = e.target.closest && e.target.closest('[data-modal-close]');
        if (c) { e.preventDefault(); Modal.close(); }
      };
      var onKey = function (e) { if (e.key === 'Escape') Modal.close(); };
      host._cleanup = function () {
        host.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey);
      };
      host.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      if (typeof opts.onOpen === 'function') {
        setTimeout(function () { try { opts.onOpen(host); } catch (e) {} }, 30);
      }
    },
    close: function () {
      var host = $('#modal-host');
      if (!host) return;
      host.classList.remove('is-open');
      if (host._cleanup) try { host._cleanup(); } catch (e) {}
      host.innerHTML = '';
    }
  };
  window.toast = toast;
  window.alertSuccess = alertSuccess;
  window.alertError = alertError;
  window.alertInfo = alertInfo;
  window.confirmModal = confirmModal;
  window.promptModal = promptModal;
  window.Spinner = Spinner;
  window.Modal = Modal;

  // ═══════════════════════════════════════════════════════════
  //  BOOT
  // ═══════════════════════════════════════════════════════════
  function setBootText(t) { var el = $('#bl-text'); if (el) el.textContent = t; }
  function hideBootLoader() { var el = $('#boot-loader'); if (el) el.hidden = true; }
  function showFatalError(msg, detail) {
    var bl = $('#boot-loader'); if (bl) { try { bl.remove(); } catch (e) {} }
    var root = $('#app-root');
    var html = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#0f172a,#1e293b)">'
      + '<div style="max-width:480px;background:rgba(255,255,255,.04);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px;color:#f1f5f9;text-align:center;font-family:Kanit,sans-serif">'
      + '<div style="width:64px;height:64px;margin:0 auto 16px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff;box-shadow:0 12px 32px rgba(239,68,68,.4)"><i class="bi bi-exclamation-triangle-fill"></i></div>'
      + '<h2 style="font-size:18px;font-weight:700;margin:0 0 8px">เกิดข้อผิดพลาด</h2>'
      + '<p style="font-size:14px;color:rgba(241,245,249,.7);margin:0 0 14px">' + esc(msg) + '</p>'
      + (detail ? '<details style="text-align:left;background:rgba(0,0,0,.2);border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px;color:#a5b4fc"><summary style="cursor:pointer;font-weight:600">รายละเอียด</summary><pre style="white-space:pre-wrap;word-break:break-all;font-size:10px;margin-top:8px">' + esc(detail) + '</pre></details>' : '')
      + '<button onclick="location.reload()" style="padding:10px 20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:0;border-radius:10px;cursor:pointer;font-weight:600;font-family:Kanit,inherit"><i class="bi bi-arrow-clockwise"></i> ลองใหม่</button>'
      + '</div></div>';
    if (root) root.innerHTML = html;
  }

  function boot() {
    setBootText('กำลังโหลดข้อมูลเริ่มต้น...');
    call('app.bootstrap', {}).then(function (data) {
      try {
        if (!data || typeof data !== 'object') throw new Error('ข้อมูล bootstrap ไม่ถูกต้อง');
        Store.boot = data;
        if (data.me) {
          // Token still valid — keep existing Store.user/caps OR sync
          Store.user = data.me;
          Store.caps = data.caps || [];
          saveSession();
        }
        hideBootLoader();
        if ((location.hash || '').indexOf('#/kiosk') === 0 && window.SLS_renderKiosk) { window.SLS_renderKiosk(); return; }
        if (Store.user) {
          if (!location.hash || location.hash === '#') {
            try { history.replaceState(null, '', location.pathname + location.search + '#/dashboard'); }
            catch (e) { location.hash = '#/dashboard'; }
          }
          dispatch();
        } else {
          clearSession();
          renderLogin();
        }
      } catch (err) {
        if (window.console) console.error('[SLS] Render error:', err);
        showFatalError('การแสดงผลล้มเหลว: ' + err.message, err.stack);
      }
    }).catch(function (e) {
      if (window.console) console.error('[SLS] Bootstrap failed:', e);
      showFatalError((e && e.message) || 'ไม่สามารถเชื่อมต่อระบบ', e && e.stack);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  PAGE META (single source of truth)
  // ═══════════════════════════════════════════════════════════
  var PAGE_META = {
    '#/dashboard':     { title: 'แดชบอร์ด',          sub: 'ภาพรวมการใช้งานห้องสมุด',     icon: 'bi-grid-1x2-fill' },
    '#/books':         { title: 'หนังสือทั้งหมด',     sub: 'ค้นหาและจัดการหนังสือ',       icon: 'bi-book-half' },
    '#/borrow':        { title: 'ยืม-คืน',            sub: 'จัดการการยืม-คืนหนังสือ',      icon: 'bi-arrow-left-right' },
    '#/loans':         { title: 'รายการยืม',          sub: 'ประวัติและสถานะการยืม',        icon: 'bi-card-checklist' },
    '#/my/loans':      { title: 'การยืมของฉัน',       sub: 'ประวัติการยืมหนังสือของฉัน',    icon: 'bi-bookmark-heart-fill' },
    '#/reservations':  { title: 'การจอง',             sub: 'จัดการการจองหนังสือ',          icon: 'bi-bookmark-star-fill' },
    '#/fines':         { title: 'ค่าปรับ',            sub: 'จัดการค่าปรับและการชำระ',      icon: 'bi-cash-coin' },
    '#/my/fines':      { title: 'ค่าปรับของฉัน',      sub: 'รายการค่าปรับที่ต้องชำระ',     icon: 'bi-receipt' },
    '#/users':         { title: 'ผู้ใช้งาน',          sub: 'จัดการบัญชีผู้ใช้',           icon: 'bi-people-fill' },
    '#/categories':    { title: 'หมวดหนังสือ',         sub: 'จัดการหมวดหมู่หนังสือ',        icon: 'bi-tags-fill' },
    '#/payment-methods':{ title: 'ช่องทางชำระ',        sub: 'จัดการช่องทางชำระค่าปรับ',     icon: 'bi-credit-card-2-front-fill' },
    '#/reports':       { title: 'รายงาน',             sub: 'รายงานและสถิติการใช้งาน',     icon: 'bi-bar-chart-fill' },
    '#/audit':         { title: 'ประวัติการใช้งาน',    sub: 'Audit log ของระบบ',           icon: 'bi-shield-check' },
    '#/settings':      { title: 'ตั้งค่าระบบ',        sub: 'การตั้งค่าทั่วไปของระบบ',      icon: 'bi-gear-fill' },
    '#/profile':       { title: 'โปรไฟล์',            sub: 'ข้อมูลส่วนตัวของฉัน',          icon: 'bi-person-circle' }
  };
  window.PAGE_META = PAGE_META;

  // ═══════════════════════════════════════════════════════════
  //  MENU
  // ═══════════════════════════════════════════════════════════
  var MENU_GROUPS = [
    { title: 'ภาพรวม', items: [
      { hash: '#/dashboard', icon: 'bi-grid-1x2-fill', label: 'แดชบอร์ด', cap: '*' }
    ]},
    { title: 'งานหลัก', items: [
      { hash: '#/borrow', icon: 'bi-arrow-left-right', label: 'ยืม-คืน', cap: 'loan.manage' },
      { hash: '#/books', icon: 'bi-book-half', label: 'หนังสือ', cap: 'book.view_all|book.manage' },
      { hash: '#/loans', icon: 'bi-card-checklist', label: 'รายการยืม', cap: 'loan.manage|report.view_all' },
      { hash: '#/my/loans', icon: 'bi-bookmark-heart-fill', label: 'การยืมของฉัน', cap: 'loan.view_own', roles: ['student','teacher'] },
      { hash: '#/reservations', icon: 'bi-bookmark-star-fill', label: 'การจอง', cap: '*' },
      { hash: '#/fines', icon: 'bi-cash-coin', label: 'ค่าปรับ', cap: 'fine.manage' },
      { hash: '#/my/fines', icon: 'bi-receipt', label: 'ค่าปรับของฉัน', cap: 'fine.view_own', roles: ['student','teacher'] }
    ]},
    { title: 'ข้อมูลหลัก', items: [
      { hash: '#/users', icon: 'bi-people-fill', label: 'ผู้ใช้งาน', cap: 'user.view_all|user.manage' },
      { hash: '#/categories', icon: 'bi-tags-fill', label: 'หมวดหนังสือ', cap: 'category.manage' },
      { hash: '#/payment-methods', icon: 'bi-credit-card-2-front-fill', label: 'ช่องทางชำระ', cap: 'paymentMethod.manage' }
    ]},
    { title: 'รายงานและประวัติ', items: [
      { hash: '#/reports', icon: 'bi-bar-chart-fill', label: 'รายงาน', cap: 'report.view_all' },
      { hash: '#/audit', icon: 'bi-shield-check', label: 'Audit Log', cap: 'audit.view_all|report.view_all' }
    ]},
    { title: 'ระบบ', items: [
      { hash: '#/settings', icon: 'bi-gear-fill', label: 'ตั้งค่าระบบ', cap: 'setting.manage' }
    ]},
    { title: 'ส่วนตัว', items: [
      { hash: '#/profile', icon: 'bi-person-circle', label: 'โปรไฟล์', cap: '*' }
    ]}
  ];
  window.MENU_GROUPS = MENU_GROUPS;

  // ═══════════════════════════════════════════════════════════
  //  ROUTES (registered by pages section)
  // ═══════════════════════════════════════════════════════════
  var Routes = {};
  window.Routes = Routes;

  // ═══════════════════════════════════════════════════════════
  //  LIVE CLOCK
  // ═══════════════════════════════════════════════════════════
  function startClock() {
    if (window.__slsClockTimer) clearInterval(window.__slsClockTimer);
    function tick() {
      var d = new Date();
      var t = n2(d.getHours()) + ':' + n2(d.getMinutes()) + ':' + n2(d.getSeconds());
      var ct = $('#sb-clock-time'); if (ct) ct.textContent = t;
      var cd = $('#sb-clock-date'); if (cd) cd.textContent = TH.dateLongWeekday(d);
      var nc = $('#nav-clock'); if (nc) nc.textContent = TH.dateWeekday(d) + ' · ' + t.substring(0, 5) + ' น.';
    }
    tick();
    window.__slsClockTimer = setInterval(tick, 1000);
  }

  // ═══════════════════════════════════════════════════════════
  //  SHELL
  // ═══════════════════════════════════════════════════════════
  function sidebarHtml() {
    var u = Store.user || {};
    var groups = MENU_GROUPS.map(function (g) {
      var items = g.items.filter(canSeeMenu);
      if (!items.length) return '';
      var links = items.map(function (m) {
        return '<a class="sb-link" href="' + esc(m.hash) + '"><i class="bi ' + esc(m.icon) + '"></i><span>' + esc(m.label) + '</span></a>';
      }).join('');
      return '<div class="sb-group"><div class="sb-group-title">' + esc(g.title) + '</div>' + links + '</div>';
    }).join('');

    return '<div class="sb-power">'
      + '<div class="sb-logo-row">'
      +   '<div class="sb-logo"><i class="bi bi-book-half"></i></div>'
      +   '<div style="min-width:0">'
      +     '<div class="sb-app-name">SLS</div>'
      +     '<div class="sb-app-sub">' + esc((Store.boot.app && Store.boot.app.org) || '') + '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="sb-card">'
      +   '<div id="sb-clock-time" class="sb-clock-time">--:--:--</div>'
      +   '<div id="sb-clock-date" class="sb-clock-date">-</div>'
      + '</div>'
      + '<div class="sb-card">'
      +   '<div class="sb-user">'
      +     '<div class="sb-avatar" style="' + avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(initials(u.full_name))) + '</div>'
      +     '<div style="flex:1;min-width:0">'
      +       '<div class="sb-user-name">' + esc(u.full_name || u.username || 'ผู้ใช้') + '</div>'
      +       '<div class="sb-user-class"><span class="role-chip role-chip-' + esc(u.role) + '"><i class="bi bi-shield-check-fill"></i>' + esc(roleLabel(u.role)) + '</span></div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '</div>'
      + '<nav class="sb-nav">' + groups + '</nav>'
      + '<div style="padding:10px 12px 16px"><a class="sb-link is-logout" href="#" data-action="logout"><i class="bi bi-box-arrow-right"></i><span>ออกจากระบบ</span></a></div>';
  }

  function navbarHtml() {
    var hash = location.hash || '#/dashboard';
    var meta = PAGE_META[hash] || PAGE_META['#/dashboard'];
    // Find best longest-match
    if (!PAGE_META[hash]) {
      var best = null, bestLen = 0;
      Object.keys(PAGE_META).forEach(function (k) {
        if (hash === k || hash.indexOf(k + '/') === 0 || hash.indexOf(k + '?') === 0) {
          if (k.length > bestLen) { best = k; bestLen = k.length; }
        }
      });
      if (best) meta = PAGE_META[best];
    }
    var u = Store.user || {};
    return '<button class="nav-burger" id="nav-burger" type="button" aria-label="เมนู"><i class="bi bi-list"></i></button>'
      + '<div class="nav-page-icon"><i class="bi ' + esc(meta.icon) + '"></i></div>'
      + '<div class="nav-page-info">'
      +   '<div class="nav-page-title">' + esc(meta.title) + '</div>'
      +   '<div class="nav-page-sub">' + esc(meta.sub) + '</div>'
      + '</div>'
      + '<div class="nav-pill online">ออนไลน์</div>'
      + '<div class="nav-pill nav-clock" id="nav-clock">--</div>'
      + '<div class="nav-actions" style="position:relative">'
      +   '<button class="nav-profile" data-action="toggle-profile" type="button">'
      +     '<div class="av" style="' + avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(initials(u.full_name))) + '</div>'
      +     '<span class="text-sm font-bold">' + esc((u.full_name || u.username || '').substring(0, 18)) + '</span>'
      +     '<i class="bi bi-chevron-down" style="font-size:12px;color:#94a3b8"></i>'
      +   '</button>'
      + '</div>';
  }

  function appMenuGridMobile() {
    var items = [
      { hash:'#/dashboard',       icon:'bi-grid-1x2-fill',          label:'หน้าแรก',   grad:'#6366f1,#4f46e5', cap:'*' },
      { hash:'#/books',           icon:'bi-book-half',              label:'หนังสือ',  grad:'#10b981,#059669', cap:'book.view_all|book.manage' },
      { hash:'#/borrow',          icon:'bi-arrow-left-right',       label:'ยืม-คืน',   grad:'#f59e0b,#d97706', cap:'loan.manage' },
      { hash:'#/my/loans',        icon:'bi-bookmark-heart-fill',    label:'การยืม',    grad:'#0ea5e9,#0284c7', cap:'loan.view_own', roles:['student','teacher'] },
      { hash:'#/loans',           icon:'bi-card-checklist',         label:'รายการยืม', grad:'#8b5cf6,#7c3aed', cap:'loan.manage|report.view_all' },
      { hash:'#/reservations',    icon:'bi-bookmark-star-fill',     label:'การจอง',    grad:'#a855f7,#7c3aed', cap:'*' },
      { hash:'#/fines',           icon:'bi-cash-coin',              label:'ค่าปรับ',   grad:'#f43f5e,#e11d48', cap:'fine.manage' },
      { hash:'#/my/fines',        icon:'bi-receipt',                label:'ค่าปรับ',   grad:'#f43f5e,#e11d48', cap:'fine.view_own', roles:['student','teacher'] },
      { hash:'#/users',           icon:'bi-people-fill',            label:'ผู้ใช้',   grad:'#ec4899,#db2777', cap:'user.view_all|user.manage' },
      { hash:'#/categories',      icon:'bi-tags-fill',              label:'หมวด',      grad:'#14b8a6,#0d9488', cap:'category.manage' },
      { hash:'#/reports',         icon:'bi-bar-chart-fill',         label:'รายงาน',    grad:'#f97316,#ea580c', cap:'report.view_all' },
      { hash:'#/profile',         icon:'bi-person-circle',          label:'โปรไฟล์',   grad:'#64748b,#475569', cap:'*' }
    ];
    var visible = items.filter(canSeeMenu).slice(0, 12);
    if (!visible.length) return '';
    var cells = visible.map(function (m) {
      return '<a href="' + esc(m.hash) + '">'
        + '<div class="app-menu-icon" style="background:linear-gradient(135deg,' + esc(m.grad) + ')"><i class="bi ' + esc(m.icon) + '"></i></div>'
        + '<span>' + esc(m.label) + '</span>'
        + '</a>';
    }).join('');
    return '<div class="app-menu-grid">' + cells + '</div>';
  }
  window.appMenuGridMobile = appMenuGridMobile;

  function bottomNavHtml() {
    var role = Store.user ? Store.user.role : '';
    var items;
    if (role === 'admin' || role === 'librarian') {
      items = [
        { hash:'#/dashboard', icon:'bi-grid-1x2-fill', label:'หน้าแรก' },
        { hash:'#/borrow', icon:'bi-arrow-left-right', label:'ยืม-คืน' },
        { hash:'#/books', icon:'bi-book-half', label:'หนังสือ' },
        { hash:'#/loans', icon:'bi-card-checklist', label:'รายการ' },
        { hash:'#/profile', icon:'bi-list', label:'เมนู' }
      ];
    } else {
      items = [
        { hash:'#/dashboard', icon:'bi-grid-1x2-fill', label:'หน้าแรก' },
        { hash:'#/books', icon:'bi-book-half', label:'หนังสือ' },
        { hash:'#/my/loans', icon:'bi-bookmark-heart-fill', label:'การยืม' },
        { hash:'#/my/fines', icon:'bi-receipt', label:'ค่าปรับ' },
        { hash:'#/profile', icon:'bi-person-circle', label:'โปรไฟล์' }
      ];
    }
    return '<nav class="app-bottom-nav" id="bottom-nav">' + items.map(function (m) {
      return '<a href="' + esc(m.hash) + '"><i class="bi ' + esc(m.icon) + '"></i><span>' + esc(m.label) + '</span></a>';
    }).join('') + '</nav>';
  }

  function appFooterHtml() {
    var d = Store.boot.dev || {};
    var year = new Date().getFullYear();
    var app = Store.boot.app || {};
    return '<div class="app-footer">'
      + '<div><span class="af-year">' + year + '</span> © ' + esc(app.name || 'SLS') + ' <span class="lf-version">v' + esc(app.version || '') + '</span></div>'
      + '<div class="af-dev">'
      +   '<a class="af-dev-link" href="' + esc(d.URL || '#') + '" target="_blank" rel="noopener noreferrer">'
      +     '<img class="af-dev-logo dev-logo-img" src="' + esc(d.LOGO || '') + '" alt="" referrerpolicy="no-referrer">'
      +   '</a>'
      +   '<div class="af-dev-text"><small>ผู้พัฒนาโดย</small><br>'
      +     '<a href="' + esc(d.URL || '#') + '" target="_blank" rel="noopener noreferrer">' + esc(d.NAME || '-') + '</a>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }

  function renderShell() {
    var html = '<div class="shell">'
      + '<aside class="sidebar" id="sidebar">' + sidebarHtml() + '</aside>'
      + '<div class="sidebar-backdrop" id="sidebar-backdrop"></div>'
      + '<div class="main-area">'
      +   '<nav class="navbar" id="navbar">' + navbarHtml() + '</nav>'
      +   '<main class="page-wrap" id="page"><div class="sk sk-block" style="height:200px;border-radius:18px;margin-bottom:14px"></div></main>'
      +   appFooterHtml()
      + '</div>'
      + bottomNavHtml()
      + '</div>';
    $('#app-root').innerHTML = html;
    startClock();
    wireDevFooter();
    updateBottomNavActive();
    updateSidebarActive();
  }

  function refreshNavbar() {
    var nb = $('#navbar');
    if (nb) nb.innerHTML = navbarHtml();
  }
  function refreshSidebar() {
    var sb = $('#sidebar');
    if (sb) {
      sb.innerHTML = sidebarHtml();
      updateSidebarActive();
    }
  }

  function updateBottomNavActive() {
    var bn = $('#bottom-nav');
    if (!bn) return;
    var hash = location.hash || '#/dashboard';
    $$('a', bn).forEach(function (a) {
      var h = a.getAttribute('href');
      if (h === hash || (h !== '#/dashboard' && hash.indexOf(h + '/') === 0) || (h !== '#/dashboard' && hash.indexOf(h + '?') === 0)) {
        a.classList.add('is-active');
      } else {
        a.classList.remove('is-active');
      }
    });
  }
  function updateSidebarActive() {
    var sb = $('#sidebar');
    if (!sb) return;
    var hash = location.hash || '#/dashboard';
    var best = null, bestLen = 0;
    $$('a.sb-link', sb).forEach(function (a) {
      a.classList.remove('is-active');
      var h = a.getAttribute('href') || '';
      if (h.charAt(0) !== '#') return;
      if (hash === h || (h !== '#' && (hash.indexOf(h + '/') === 0 || hash.indexOf(h + '?') === 0))) {
        if (h.length > bestLen) { best = a; bestLen = h.length; }
      }
    });
    if (best) best.classList.add('is-active');
  }

  function wireDevFooter() {
    $$('.dev-logo-img').forEach(function (img) {
      if (img.__wired) return;
      img.__wired = true;
      img.addEventListener('error', function () {
        img.style.display = 'none';
      }, { once: true });
    });
  }

  function closeSidebar() {
    var sb = $('#sidebar'); if (sb) sb.classList.remove('open');
    var bd = $('#sidebar-backdrop'); if (bd) bd.classList.remove('show');
  }
  function toggleSidebar() {
    var sb = $('#sidebar'); var bd = $('#sidebar-backdrop');
    if (!sb || !bd) return;
    var open = sb.classList.toggle('open');
    if (open) bd.classList.add('show'); else bd.classList.remove('show');
  }

  function wireShell() {
    if (window.__slsShellWired) return;
    window.__slsShellWired = true;
    // Document-level click delegation
    document.addEventListener('click', function (e) {
      // [data-action] actions (priority 1)
      var actionEl = e.target.closest && e.target.closest('[data-action]');
      if (actionEl) {
        var act = actionEl.getAttribute('data-action');
        if (act === 'logout') {
          e.preventDefault();
          doLogout();
          return;
        }
        if (act === 'toggle-profile') {
          e.preventDefault();
          toggleProfilePopover();
          return;
        }
      }
      // Burger
      if (e.target.closest('#nav-burger')) { toggleSidebar(); return; }
      if (e.target.closest('#sidebar-backdrop')) { closeSidebar(); return; }
      // Mobile auto-close sidebar
      if (window.innerWidth <= 1024) {
        var lnk = e.target.closest('#sidebar a.sb-link');
        if (lnk) { setTimeout(closeSidebar, 50); }
      }
      // Hash link interceptor (priority 4 — last for navigation)
      var a = e.target.closest && e.target.closest('a[href]');
      if (a) {
        var href = a.getAttribute('href');
        if (href && href.charAt(0) === '#') {
          if (href === '#') return; // dummy
          if (a.target && a.target !== '_top' && a.target !== '_self') return;
          e.preventDefault();
          if (href === location.hash) dispatch();
          else location.hash = href;
        }
      }
      // Outside click → close profile popover
      var pop = $('.nav-profile-popover');
      if (pop && !e.target.closest('.nav-profile-popover') && !e.target.closest('[data-action="toggle-profile"]')) {
        pop.remove();
      }
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeSidebar();
        var pop = $('.nav-profile-popover'); if (pop) pop.remove();
      }
    });
    window.addEventListener('hashchange', dispatch);
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024) closeSidebar();
    });
  }

  function toggleProfilePopover() {
    var existing = $('.nav-profile-popover');
    if (existing) { existing.remove(); return; }
    var u = Store.user || {};
    var nav = $('.nav-actions');
    if (!nav) return;
    var pop = document.createElement('div');
    pop.className = 'nav-profile-popover';
    pop.innerHTML = '<div class="nav-pop-head">'
      + '<div class="av" style="' + avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(initials(u.full_name))) + '</div>'
      + '<div style="min-width:0">'
      +   '<div class="nav-pop-name">' + esc(u.full_name || u.username) + '</div>'
      +   '<div class="nav-pop-email">' + esc(u.email || '') + '</div>'
      +   '<div style="margin-top:4px"><span class="role-chip role-chip-' + esc(u.role) + '"><i class="bi bi-shield-check-fill"></i>' + esc(roleLabel(u.role)) + '</span></div>'
      + '</div></div>'
      + '<a class="nav-pop-item" href="#/profile"><i class="bi bi-person"></i>โปรไฟล์</a>'
      + '<a class="nav-pop-item" href="#" data-action="change-password"><i class="bi bi-key"></i>เปลี่ยนรหัสผ่าน</a>'
      + '<div class="nav-pop-divider"></div>'
      + '<a class="nav-pop-item danger" href="#" data-action="logout"><i class="bi bi-box-arrow-right"></i>ออกจากระบบ</a>';
    nav.appendChild(pop);
    pop.addEventListener('click', function (e) {
      var act = e.target.closest && e.target.closest('[data-action]');
      if (act && act.getAttribute('data-action') === 'change-password') {
        e.preventDefault();
        pop.remove();
        openChangePasswordModal();
      }
    });
  }

  function openChangePasswordModal() {
    Modal.open({
      title: 'เปลี่ยนรหัสผ่าน',
      titleIcon: 'bi-key-fill',
      html: '<form id="cpw-form">'
        + '<div class="field"><label>รหัสผ่านปัจจุบัน<span class="req">*</span></label>'
        + '<input class="input" type="password" name="current" required></div>'
        + '<div class="field"><label>รหัสผ่านใหม่<span class="req">*</span></label>'
        + '<input class="input" type="password" name="next" required minlength="6">'
        + '<div class="field-hint">อย่างน้อย 6 ตัวอักษร</div></div>'
        + '<div class="field"><label>ยืนยันรหัสผ่านใหม่<span class="req">*</span></label>'
        + '<input class="input" type="password" name="confirm" required minlength="6"></div>'
        + '</form>',
      footer: '<button class="btn" data-modal-close type="button">ยกเลิก</button>'
            + '<button class="btn btn-primary" type="button" id="cpw-submit"><i class="bi bi-check-circle"></i> บันทึก</button>',
      onOpen: function (host) {
        $('#cpw-submit', host).addEventListener('click', function () {
          var f = $('#cpw-form', host);
          var cur = f.current.value;
          var nxt = f.next.value;
          var cnf = f.confirm.value;
          if (!cur || !nxt) return toast('กรอกข้อมูลให้ครบ', 'warning');
          if (nxt !== cnf) return toast('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน', 'warning');
          if (nxt.length < 6) return toast('รหัสผ่านใหม่ต้องอย่างน้อย 6 ตัวอักษร', 'warning');
          Spinner.show('กำลังเปลี่ยนรหัสผ่าน', { stages: ['ตรวจสอบรหัสเดิม', 'บันทึก', 'เสร็จสิ้น'] });
          call('auth.change_password', { current: cur, next: nxt }).then(function () {
            Spinner.hide();
            Modal.close();
            alertSuccess('สำเร็จ', 'เปลี่ยนรหัสผ่านแล้ว');
          }).catch(function (e) {
            Spinner.hide();
            toast(e.message, 'error');
          });
        });
      }
    });
  }

  function doLogout() {
    confirmModal({
      title: 'ออกจากระบบ', message: 'ยืนยันการออกจากระบบ?', danger: true,
      okText: 'ออกจากระบบ', cancelText: 'ยกเลิก'
    }).then(function (ok) {
      if (!ok) return;
      Spinner.show('กำลังออกจากระบบ', { stages: ['ล้างเซสชัน', 'ออกจากระบบ', 'เสร็จสิ้น'] });
      var oldToken = Store.token;
      call('auth.logout', { token: oldToken }).catch(function () {}).then(function () {
        clearSession();
        Modal.close();
        Spinner.hide();
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        if (window.__slsClockTimer) { clearInterval(window.__slsClockTimer); window.__slsClockTimer = null; }
        renderLogin();
        toast('ออกจากระบบเรียบร้อย', 'success', 1800);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  ROUTER
  // ═══════════════════════════════════════════════════════════
  function dispatch() {
    if ((location.hash || '').indexOf('#/kiosk') === 0 && window.SLS_renderKiosk) { window.SLS_renderKiosk(); return; }
    if (!Store.token || !Store.user) {
      if (!$('#app-root') || !$('#app-root').querySelector('.login-stage')) renderLogin();
      return;
    }
    if (!$('#sidebar')) {
      renderShell();
    } else {
      refreshNavbar();
      refreshSidebar();
      updateBottomNavActive();
    }
    var hash = location.hash || '#/dashboard';
    // 4-stage resolution
    var handler = Routes[hash];
    if (!handler) handler = Routes[hash.split('?')[0]];
    if (!handler) {
      var parts = hash.split('?')[0].split('/');
      while (parts.length > 1 && !handler) {
        parts.pop();
        var p = parts.join('/');
        if (p && p !== '#') handler = Routes[p];
        else break;
      }
    }
    if (!handler) handler = Routes['#/dashboard'];
    if (handler) {
      try { handler(hash); }
      catch (e) {
        if (window.console) console.error('[SLS] Route error:', e);
        var page = $('#page');
        if (page) page.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>เกิดข้อผิดพลาด: ' + esc(e.message) + '</p></div>';
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ═══════════════════════════════════════════════════════════
  //  LOGIN PAGE
  // ═══════════════════════════════════════════════════════════
  function loginParticles() {
    var html = '';
    for (var i = 0; i < 18; i++) {
      var left = Math.floor(Math.random() * 100);
      var dur = 14 + Math.floor(Math.random() * 12);
      var delay = -Math.floor(Math.random() * 17);
      html += '<span style="left:' + left + '%;animation-duration:' + dur + 's;animation-delay:' + delay + 's;width:' + (4 + Math.floor(Math.random()*6)) + 'px;height:' + (4 + Math.floor(Math.random()*6)) + 'px"></span>';
    }
    return '<div class="login-particles">' + html + '</div>'
      + '<style>@keyframes floatUp{from{transform:translateY(0);opacity:0}10%{opacity:.5}90%{opacity:.5}to{transform:translateY(-110vh);opacity:0}}</style>';
  }

  function demoUsersHtml() {
    var users = [
      { username: 'admin',     role: 'admin',     label: 'ผู้ดูแลระบบ', icon: 'bi-shield-fill-check' },
      { username: 'librarian', role: 'librarian', label: 'บรรณารักษ์', icon: 'bi-person-badge-fill' },
      { username: 'teacher',   role: 'teacher',   label: 'ครู',         icon: 'bi-mortarboard-fill' },
      { username: 'student',   role: 'student',   label: 'นักเรียน',     icon: 'bi-emoji-smile-fill' }
    ];
    var cards = users.map(function (u) {
      return '<button type="button" class="lf-demo-card" data-role="' + esc(u.role) + '" data-username="' + esc(u.username) + '" aria-label="เข้าสู่ระบบด้วยบัญชี ' + esc(u.label) + '">'
        + '<div class="lf-demo-icon"><i class="bi ' + esc(u.icon) + '"></i></div>'
        + '<div class="lf-demo-role">' + esc(u.label) + '</div>'
        + '<div class="lf-demo-user">' + esc(u.username) + '</div>'
        + '</button>';
    }).join('');
    return '<div class="lf-demo-wrap">'
      + '<div class="lf-demo-head"><i class="bi bi-stars" style="color:#fbbf24"></i> ทดลองใช้งานด้วยบัญชีตัวอย่าง <span class="lf-demo-pill">DEMO</span></div>'
      + '<div class="lf-demo-grid">' + cards + '</div>'
      + '<div class="lf-demo-footer"><i class="bi bi-hand-index-thumb-fill"></i> คลิกการ์ดเพื่อเข้าสู่ระบบทันที (รหัสผ่าน: <strong>123456</strong>)</div>'
      + '</div>';
  }

  function submitButtonHtml(label) {
    return '<button type="submit" class="lf-submit" id="lf-submit">'
      + '<span class="lf-submit-state lf-submit-state-default"><i class="bi bi-box-arrow-in-right"></i> ' + esc(label) + '</span>'
      + '<span class="lf-submit-state lf-submit-state-loading">'
      +   '<span class="lf-droplets"><span></span><span></span><span></span></span>'
      +   '<span class="lf-submit-status">กำลังตรวจสอบ...</span>'
      + '</span>'
      + '<span class="lf-submit-state lf-submit-state-success"><i class="bi bi-check-circle-fill"></i><span>เข้าสู่ระบบสำเร็จ!</span></span>'
      + '<span class="lf-submit-state lf-submit-state-error"><i class="bi bi-exclamation-triangle-fill"></i><span>ไม่สำเร็จ</span></span>'
      + '</button>';
  }

  function loginFooterHtml() {
    var d = (Store.boot && Store.boot.dev) || {};
    var year = new Date().getFullYear();
    var app = (Store.boot && Store.boot.app) || {};
    return '<div class="login-footer">'
      + '<div>' + year + ' © ' + esc(app.name || 'SLS') + ' <span class="lf-version">v' + esc(app.version || '1.0.0') + '</span></div>'
      + '<div class="lf-dev">'
      +   '<a class="lf-dev-link" href="' + esc(d.URL || '#') + '" target="_blank" rel="noopener noreferrer">'
      +     '<img class="lf-dev-logo dev-logo-img" src="' + esc(d.LOGO || '') + '" alt="" referrerpolicy="no-referrer">'
      +   '</a>'
      +   '<div class="lf-dev-text"><small>ผู้พัฒนาโดย</small><br>'
      +     '<a href="' + esc(d.URL || '#') + '" target="_blank" rel="noopener noreferrer">' + esc((d.URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '') || (d.NAME || '-')) + '</a>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }

  function renderLogin() {
    var settings = (Store.boot && Store.boot.settings) || {};
    var showDemo = String(settings.show_demo_users || 'yes').toLowerCase() === 'yes';
    var lastUser = '';
    try { lastUser = localStorage.getItem('sls.lastUser') || ''; } catch (e) {}
    var hasUsers = Store.boot.has_users;

    var brandHtml = '<aside class="lf-brand">'
      + '<div class="lf-brand-head">'
      +   '<div class="lf-brand-logo"><i class="bi bi-book-half"></i></div>'
      +   '<div><div class="lf-brand-name">' + esc((Store.boot.app && Store.boot.app.name) || 'SLS') + '</div>'
      +     '<div class="lf-brand-tagline">' + esc((Store.boot.app && Store.boot.app.org) || 'School Library System') + '</div></div>'
      + '</div>'
      + '<div class="lf-brand-big">ห้องสมุดในมือคุณ<br><span class="shine">ค้นหา ยืม คืน · ด้วยคลิกเดียว</span></div>'
      + '<div class="lf-features">'
      +   '<div class="lf-feat"><div class="lf-feat-icon g1"><i class="bi bi-qr-code-scan"></i></div><div><div class="lf-feat-title">ยืม-คืนด้วย QR Code</div><div class="lf-feat-desc">สแกนเดียวเสร็จ ไม่ต้องกรอกข้อมูล ลดข้อผิดพลาด</div></div></div>'
      +   '<div class="lf-feat"><div class="lf-feat-icon g2"><i class="bi bi-search-heart-fill"></i></div><div><div class="lf-feat-title">ค้นหาเร็วแม่นยำ</div><div class="lf-feat-desc">ค้นด้วยชื่อ ผู้แต่ง รหัส ISBN ทันที</div></div></div>'
      +   '<div class="lf-feat"><div class="lf-feat-icon g3"><i class="bi bi-bookmark-heart-fill"></i></div><div><div class="lf-feat-title">จองล่วงหน้าได้</div><div class="lf-feat-desc">นักเรียนจองเล่มที่ต้องการก่อนเข้ามาที่ห้องสมุด</div></div></div>'
      +   '<div class="lf-feat"><div class="lf-feat-icon g4"><i class="bi bi-graph-up"></i></div><div><div class="lf-feat-title">รายงานแบบ Real-time</div><div class="lf-feat-desc">ดูสถิติยอดยืม หนังสือยอดนิยม คนที่อ่านเยอะ</div></div></div>'
      + '</div>'
      + '<div class="lf-stats">'
      +   '<div class="lf-stat"><div class="lf-stat-num">100K+</div><div class="lf-stat-label">เล่ม</div></div>'
      +   '<div class="lf-stat"><div class="lf-stat-num">99.9%</div><div class="lf-stat-label">เสถียร</div></div>'
      +   '<div class="lf-stat"><div class="lf-stat-num">24/7</div><div class="lf-stat-label">ใช้งานได้</div></div>'
      + '</div>'
      + '</aside>';

    var formHtml = '<div class="lf-form-wrap">'
      + '<div class="lf-mini-brand"><div class="lf-brand-logo" style="width:36px;height:36px;font-size:18px;border-radius:10px"><i class="bi bi-book-half"></i></div>'
      +   '<div><div class="lf-brand-name" style="font-size:16px">SLS</div><div class="lf-brand-tagline" style="font-size:11px">' + esc((Store.boot.app && Store.boot.app.name) || '') + '</div></div></div>'
      + '<div class="lf-form-title">ยินดีต้อนรับกลับ</div>'
      + '<div class="lf-form-sub">เข้าสู่ระบบเพื่อใช้งานห้องสมุด</div>'
      + '<form id="login-form" class="lf-form" novalidate>'
      +   '<div class="lf-input-wrap"><i class="bi bi-person-fill lf-icon"></i>'
      +     '<input type="text" name="username" class="lf-input" placeholder="ชื่อผู้ใช้ (username)" autocomplete="username" spellcheck="false" value="' + esc(lastUser) + '" required>'
      +   '</div>'
      +   '<div class="lf-input-wrap"><i class="bi bi-lock-fill lf-icon"></i>'
      +     '<input type="password" name="password" id="lf-pwd" class="lf-input" placeholder="รหัสผ่าน" autocomplete="current-password" required style="padding-right:42px">'
      +     '<button type="button" class="lf-toggle" id="lf-eye" tabindex="-1" aria-label="แสดงรหัสผ่าน"><i class="bi bi-eye"></i></button>'
      +   '</div>'
      +   '<div class="lf-warn" id="lf-caps"><i class="bi bi-exclamation-triangle-fill"></i> เปิด Caps Lock อยู่</div>'
      +   '<div class="lf-row">'
      +     '<label class="lf-check"><input type="checkbox" name="remember" ' + (lastUser ? 'checked' : '') + '>'
      +       '<span class="lf-check-box"></span><span>จดจำฉัน</span></label>'
      +     '<button type="button" class="lf-forgot" id="lf-forgot">ลืมรหัสผ่าน?</button>'
      +   '</div>'
      +   submitButtonHtml('เข้าสู่ระบบ')
      + '</form>'
      + (hasUsers && showDemo ? demoUsersHtml() : '')
      + '</div>';

    var html = '<div class="login-stage">'
      + loginParticles()
      + '<div class="login-shell">' + brandHtml + formHtml + '</div>'
      + loginFooterHtml()
      + '</div>';
    $('#app-root').innerHTML = html;
    hideBootLoader();
    try { wireLogin(); } catch (e) { if (window.console) console.error('[SLS] wireLogin:', e); }
    wireDevFooter();
  }

  function wireLogin() {
    var form = $('#login-form');
    if (!form) return;
    var first = form.querySelector('input[name="username"]');
    var pwd = $('#lf-pwd');
    if (first && first.value) { setTimeout(function () { try { pwd.focus(); } catch (e) {} }, 80); }
    else if (first) { setTimeout(function () { try { first.focus(); } catch (e) {} }, 80); }

    // Eye toggle
    var eye = $('#lf-eye');
    if (eye) eye.addEventListener('click', function () {
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
      eye.querySelector('i').className = 'bi ' + (pwd.type === 'password' ? 'bi-eye' : 'bi-eye-slash');
    });
    // Caps lock warn
    pwd.addEventListener('keydown', function (e) {
      var on = e.getModifierState && e.getModifierState('CapsLock');
      var w = $('#lf-caps');
      if (w) w.classList.toggle('show', !!on);
    });
    // Forgot
    var forgot = $('#lf-forgot');
    if (forgot) forgot.addEventListener('click', function () {
      toast('กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน', 'info', 4000);
    });

    // Demo cards
    $$('.lf-demo-card').forEach(function (c) {
      c.addEventListener('click', function () {
        form.username.value = c.getAttribute('data-username') || '';
        form.password.value = '123456';
        form.username.dispatchEvent(new Event('input', { bubbles: true }));
        form.password.dispatchEvent(new Event('input', { bubbles: true }));
        try {
          if (typeof form.requestSubmit === 'function') form.requestSubmit();
          else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        } catch (e) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      });
    });

    // Submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('#lf-submit');
      if (btn.getAttribute('data-state')) return;
      var username = form.username.value.trim();
      var password = form.password.value;
      if (!username || !password) {
        toast('กรอกข้อมูลให้ครบ', 'warning'); return;
      }
      // Multi-stage status
      btn.setAttribute('data-state', 'loading');
      var stages = ['กำลังตรวจสอบข้อมูล...', 'ยืนยันตัวตน...', 'เตรียมระบบ...', 'เกือบเสร็จแล้ว...'];
      var idx = 0;
      var statusEl = btn.querySelector('.lf-submit-status');
      if (statusEl) statusEl.textContent = stages[0];
      var stageTimer = setInterval(function () {
        idx = (idx + 1) % stages.length;
        if (statusEl) statusEl.textContent = stages[idx];
      }, 700);

      call('auth.login', { username: username, password: password, user_agent: navigator.userAgent || '' })
        .then(function (res) {
          clearInterval(stageTimer);
          Store.token = res.token;
          Store.user = res.user;
          Store.caps = res.caps;
          saveSession();
          if (form.remember.checked) {
            try { localStorage.setItem('sls.lastUser', res.user.username); } catch (e) {}
          } else {
            try { localStorage.removeItem('sls.lastUser'); } catch (e) {}
          }
          btn.setAttribute('data-state', 'success');
          setTimeout(function () {
            // history.replaceState + dispatch (no hashchange race)
            try { history.replaceState(null, '', location.pathname + location.search + '#/dashboard'); }
            catch (e) { location.hash = '#/dashboard'; }
            dispatch();
          }, 750);
        })
        .catch(function (e) {
          clearInterval(stageTimer);
          btn.setAttribute('data-state', 'error');
          toast(e.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
          setTimeout(function () { btn.removeAttribute('data-state'); }, 1600);
        });
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  COMMON UI HELPERS for pages
  // ═══════════════════════════════════════════════════════════
  function pageWrap(content) {
    var page = $('#page');
    if (!page) return;
    page.innerHTML = appMenuGridMobile() + content;
  }
  function heroHtml(opts) {
    opts = opts || {};
    return '<div class="sd-hero" style="background:' + esc(opts.grad || 'linear-gradient(135deg,#10b981 0%,#059669 50%,#34d399 100%)') + '">'
      + '<div class="sd-hero-pill"><i class="bi ' + esc(opts.icon || 'bi-grid-1x2-fill') + '"></i> ' + esc(opts.pill || '') + '</div>'
      + (opts.greet ? '<div class="sd-hero-greet">' + esc(opts.greet) + '</div>' : '')
      + '<div class="sd-hero-title">' + esc(opts.title || '') + '</div>'
      + (opts.sub ? '<div class="sd-hero-sub">' + esc(opts.sub) + '</div>' : '')
      + (opts.actions ? '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' + opts.actions + '</div>' : '')
      + '</div>';
  }
  function statCard(opts) {
    return '<div class="sd-stat">'
      + '<div class="sd-stat-row">'
      +   '<div><div class="sd-stat-label">' + esc(opts.label || '') + '</div></div>'
      +   '<div class="sd-stat-icon ' + esc(opts.color || 'g-indigo') + '"><i class="bi ' + esc(opts.icon || 'bi-circle') + '"></i></div>'
      + '</div>'
      + '<div class="sd-stat-value">' + esc(opts.value == null ? '0' : opts.value) + '</div>'
      + (opts.sub ? '<div class="sd-stat-sub">' + esc(opts.sub) + '</div>' : '')
      + '</div>';
  }
  function emptyState(msg, icon, cta) {
    return '<div class="empty-state"><i class="bi ' + esc(icon || 'bi-inbox') + '"></i><p>' + esc(msg || 'ยังไม่มีข้อมูล') + '</p>' + (cta ? '<div class="es-cta">' + cta + '</div>' : '') + '</div>';
  }
  function skBlock(h) { return '<div class="sk sk-block" style="height:' + (h || 100) + 'px;border-radius:14px;margin-bottom:10px"></div>'; }
  function bookCoverHtml(b) {
    if (b.cover_url) {
      return '<img src="' + esc(b.cover_url) + '" alt="' + esc(b.title) + '" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\'">'
        + '<div class="book-cover-fallback" style="display:none"><i class="bi bi-book"></i><div class="t">' + esc(b.title) + '</div></div>';
    }
    return '<div class="book-cover-fallback"><i class="bi bi-book"></i><div class="t">' + esc(b.title) + '</div></div>';
  }
  function loanStatusBadge(s) {
    var map = (Store.boot.statuses && Store.boot.statuses.loan) || {};
    var icon = { borrowed:'bi-arrow-up-circle', returned:'bi-check-circle', overdue:'bi-exclamation-triangle', lost:'bi-x-circle' }[s] || 'bi-question-circle';
    return '<span class="badge b-' + esc(s) + '"><i class="bi ' + icon + '"></i> ' + esc(map[s] || s) + '</span>';
  }
  function reservStatusBadge(s) {
    var map = (Store.boot.statuses && Store.boot.statuses.reservation) || {};
    var icon = { active:'bi-hourglass-split', fulfilled:'bi-check-circle', cancelled:'bi-x-circle', expired:'bi-clock-history' }[s] || 'bi-question-circle';
    return '<span class="badge b-' + esc(s) + '"><i class="bi ' + icon + '"></i> ' + esc(map[s] || s) + '</span>';
  }
  function greetByTime() {
    var h = new Date().getHours();
    if (h < 12) return 'อรุณสวัสดิ์';
    if (h < 17) return 'สวัสดี';
    return 'สวัสดียามเย็น';
  }

  // ═══════════════════════════════════════════════════════════
  //  SVG CHART HELPERS
  // ═══════════════════════════════════════════════════════════
  function svgLine(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return emptyState('ยังไม่มีข้อมูลแนวโน้ม', 'bi-graph-up');
    var w = opts.w || 600, h = opts.h || 200;
    var pad = { t: 14, r: 14, b: 28, l: 30 };
    var max = Math.max.apply(Math, data.map(function (d) { return Math.max(d.borrowed || 0, d.returned || 0); }));
    if (max < 4) max = 4;
    var ix = function (i) { return pad.l + (data.length === 1 ? 0 : (i * (w - pad.l - pad.r) / (data.length - 1))); };
    var iy = function (v) { return h - pad.b - (v / max) * (h - pad.t - pad.b); };

    var grid = '';
    for (var i = 0; i < 4; i++) {
      var gy = pad.t + i * (h - pad.t - pad.b) / 4;
      grid += '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (w - pad.r) + '" y2="' + gy + '" stroke="#e2e8f0" stroke-dasharray="3 3"/>';
    }
    var pathB = data.map(function (d, i) { return (i === 0 ? 'M' : 'L') + ix(i) + ',' + iy(d.borrowed || 0); }).join(' ');
    var pathR = data.map(function (d, i) { return (i === 0 ? 'M' : 'L') + ix(i) + ',' + iy(d.returned || 0); }).join(' ');
    var area = pathB + ' L' + ix(data.length - 1) + ',' + (h - pad.b) + ' L' + ix(0) + ',' + (h - pad.b) + ' Z';
    var dots = data.map(function (d, i) {
      return '<circle cx="' + ix(i) + '" cy="' + iy(d.borrowed || 0) + '" r="3" fill="#6366f1"/>';
    }).join('');
    var xlabels = '';
    var step = Math.max(1, Math.floor(data.length / 7));
    for (var j = 0; j < data.length; j += step) {
      var d = new Date(data[j].date);
      xlabels += '<text x="' + ix(j) + '" y="' + (h - 8) + '" font-size="10" text-anchor="middle" fill="#94a3b8">' + (isNaN(d.getTime()) ? '' : (d.getDate() + '/' + (d.getMonth()+1))) + '</text>';
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" width="100%" height="' + h + '">'
      + '<defs><linearGradient id="lnArea" x1="0" y1="0" x2="0" y2="1">'
      +   '<stop offset="0%" stop-color="#6366f1" stop-opacity=".25"/>'
      +   '<stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>'
      + '</linearGradient></defs>'
      + grid
      + '<path d="' + area + '" fill="url(#lnArea)"/>'
      + '<path d="' + pathB + '" fill="none" stroke="#6366f1" stroke-width="2.5"/>'
      + '<path d="' + pathR + '" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="4 3"/>'
      + dots
      + xlabels
      + '</svg>'
      + '<div class="text-xs muted mt-2 flex gap-3"><span><i class="bi bi-circle-fill" style="color:#6366f1"></i> ยืม</span><span><i class="bi bi-dash-lg" style="color:#10b981"></i> คืน</span></div>';
  }
  function svgDonut(items, total) {
    if (!items || !items.length || total === 0) {
      return '<svg viewBox="0 0 100 100" width="100%" style="max-width:160px"><circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" stroke-width="14"/></svg>'
        + '<div class="text-center mt-2 text-sm muted">ยังไม่มีข้อมูล</div>';
    }
    var R = 40, C = 2 * Math.PI * R;
    var offset = 0;
    var arcs = items.map(function (it) {
      var pct = total ? (it.count / total) : 0;
      var len = pct * C;
      var dash = len + ' ' + (C - len);
      var seg = '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="' + (it.color || '#6366f1') + '" stroke-width="14" stroke-dasharray="' + dash + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 50 50)"/>';
      offset += len;
      return seg;
    }).join('');
    var legend = items.map(function (it) {
      var pct = total ? Math.round(it.count / total * 100) : 0;
      return '<div class="flex items-center gap-2 text-xs"><span style="width:10px;height:10px;border-radius:3px;background:' + esc(it.color || '#6366f1') + '"></span>'
        + '<span style="flex:1">' + esc(it.label) + '</span>'
        + '<span class="font-bold">' + it.count + ' (' + pct + '%)</span></div>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:160px 1fr;gap:14px;align-items:center;min-width:0" class="donut-row">'
      + '<svg viewBox="0 0 100 100" width="160" height="160"><circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" stroke-width="14"/>' + arcs + '<text x="50" y="48" font-size="14" text-anchor="middle" fill="#1e293b" font-weight="700">รวม</text><text x="50" y="62" font-size="11" text-anchor="middle" fill="#64748b">' + total + '</text></svg>'
      + '<div class="flex-col gap-2" style="min-width:0">' + legend + '</div>'
      + '</div>'
      + '<style>@media(max-width:540px){.donut-row{grid-template-columns:1fr!important;justify-items:center}}</style>';
  }
  function svgHorizBar(items) {
    if (!items || !items.length) return emptyState('ยังไม่มีข้อมูล', 'bi-bar-chart');
    var max = Math.max.apply(Math, items.map(function (i) { return cfgNum(i.count); }));
    if (max < 1) max = 1;
    return '<div class="flex-col gap-2">' + items.map(function (it) {
      var pct = (cfgNum(it.count) / max) * 100;
      return '<div>'
        + '<div class="flex justify-between text-xs mb-2"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">' + esc(it.label || it.key || '') + '</span><span class="font-bold">' + esc(String(it.count)) + '</span></div>'
        + '<div style="height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + esc(it.color || '#6366f1') + ',' + esc(it.color || '#8b5cf6') + ');border-radius:99px;transition:width .8s ease"></div></div>'
        + '</div>';
    }).join('') + '</div>';
  }
  function cfgNum(v) { var n = Number(v); return isNaN(n) ? 0 : n; }

  // ═══════════════════════════════════════════════════════════
  //  FILE UPLOAD HELPER (data URL upload)
  // ═══════════════════════════════════════════════════════════
  function uploadFile(file, kind) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('ไม่พบไฟล์'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('ไฟล์ต้องไม่เกิน 8MB'));
      var r = new FileReader();
      r.onload = function () {
        call('file.upload', { data_url: r.result, file_name: file.name, kind: kind || 'misc' }, 120000)
          .then(resolve).catch(reject);
      };
      r.onerror = function () { reject(new Error('อ่านไฟล์ไม่สำเร็จ')); };
      r.readAsDataURL(file);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  EXPOSE PUBLIC SURFACE for pages section
  // ═══════════════════════════════════════════════════════════
  window.SLS_boot = boot;
  window.SLS_dispatch = dispatch;
  window.SLS_renderShell = renderShell;
  window.SLS_renderLogin = renderLogin;
  window.SLS_refreshNavbar = refreshNavbar;
  window.SLS_updateBottomNavActive = updateBottomNavActive;
  window.SLS_updateSidebarActive = updateSidebarActive;
  window.SLS_Store = Store;
  window.SLS_saveSession = saveSession;
  window.SLS_clearSession = clearSession;
  // Helpers
  window.SLS = {
    $: $, $$: $$, esc: esc, escAttr: escAttr, initials: initials, avatarStyle: avatarStyle, roleLabel: roleLabel,
    hasCap: hasCap, canSeeMenu: canSeeMenu, n2: n2,
    pageWrap: pageWrap, heroHtml: heroHtml, statCard: statCard, emptyState: emptyState, skBlock: skBlock,
    bookCoverHtml: bookCoverHtml, loanStatusBadge: loanStatusBadge, reservStatusBadge: reservStatusBadge,
    greetByTime: greetByTime,
    svgLine: svgLine, svgDonut: svgDonut, svgHorizBar: svgHorizBar,
    uploadFile: uploadFile,
    Routes: Routes,
    Store: Store
  };

  wireShell();

  // ═══════════════════════════════════════════════════════════
  //  AUTO START (in case DOM ready before listener)
  // ═══════════════════════════════════════════════════════════
  function start() {
    if (window.__slsBootCalled) return;
    window.__slsBootCalled = true;
    boot();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 2: PAGES (จาก ScriptsPages.html เดิม — ไม่มีการแก้ logic)
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var $ = window.SLS.$;
  var $$ = window.SLS.$$;
  var esc = window.SLS.esc;
  var Store = window.SLS_Store;
  var Routes = window.Routes;
  var H = window.SLS; // helpers
  function cfgNum(v) { var n = Number(v); return isNaN(n) ? 0 : n; }

  // QR loader (lazy with 3 CDN fallbacks)
  var __QR_LIB_PROMISE = null;
  function loadQRLib() {
    if (typeof QRCode !== 'undefined') return Promise.resolve(QRCode);
    if (__QR_LIB_PROMISE) return __QR_LIB_PROMISE;
    var sources = [
      'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
      'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js'
    ];
    __QR_LIB_PROMISE = new Promise(function (resolve, reject) {
      function tryLoad(idx) {
        if (typeof QRCode !== 'undefined') return resolve(QRCode);
        if (idx >= sources.length) {
          __QR_LIB_PROMISE = null;
          return reject(new Error('โหลด QR library ไม่สำเร็จ'));
        }
        var s = document.createElement('script');
        s.src = sources[idx];
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = function () {
          if (typeof QRCode !== 'undefined') resolve(QRCode);
          else tryLoad(idx + 1);
        };
        s.onerror = function () { tryLoad(idx + 1); };
        document.head.appendChild(s);
      }
      tryLoad(0);
    });
    return __QR_LIB_PROMISE;
  }

  // ═══════════════════════════════════════════════════════════
  //  DASHBOARD
  // ═══════════════════════════════════════════════════════════
  Routes['#/dashboard'] = function () {
    var u = Store.user || {};
    H.pageWrap(H.skBlock(160) + H.skBlock(120));
    window.call('report.dashboard', {}).then(function (data) {
      if (!$('#page')) return;
      if (data.mode === 'staff') renderStaffDashboard(data);
      else renderUserDashboard(data);
    }).catch(function (e) { toast(e.message, 'error'); });
  };

  function renderStaffDashboard(d) {
    var u = Store.user || {};
    var hero = H.heroHtml({
      icon: 'bi-stars',
      pill: H.roleLabel(u.role) + ' · ' + (Store.boot.app && Store.boot.app.name),
      greet: H.greetByTime() + ', ' + (u.full_name || u.username),
      title: 'ภาพรวมห้องสมุด',
      sub: 'รายงานสด · เรียลไทม์',
      grad: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%)'
    });
    var stats = '<div class="sd-stagger">'
      + H.statCard({ label: 'หนังสือ (ปก)', value: d.books.total.toLocaleString(), sub: 'รวมเล่ม ' + d.books.copies.toLocaleString(), color: 'g-indigo', icon: 'bi-book-half' })
      + H.statCard({ label: 'พร้อมยืม', value: d.books.available.toLocaleString(), sub: 'เล่มว่างพร้อมให้ยืม', color: 'g-emerald', icon: 'bi-check-circle-fill' })
      + H.statCard({ label: 'กำลังยืม', value: d.loans.active.toLocaleString(), sub: 'เกินกำหนด ' + d.loans.overdue, color: 'g-sky', icon: 'bi-arrow-up-circle' })
      + H.statCard({ label: 'เกินกำหนด', value: d.loans.overdue.toLocaleString(), sub: 'ต้องติดตาม', color: 'g-rose', icon: 'bi-exclamation-triangle-fill' })
      + H.statCard({ label: 'ค่าปรับค้างจ่าย', value: '฿' + d.fines.unpaid.toLocaleString(), sub: 'ชำระแล้ว ฿' + d.fines.paid.toLocaleString(), color: 'g-amber', icon: 'bi-cash-coin' })
      + H.statCard({ label: 'การจอง', value: d.reservations.active.toLocaleString(), sub: 'รอรับ', color: 'g-violet', icon: 'bi-bookmark-star-fill' })
      + '</div>';

    var chartTrend = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-graph-up"></i> แนวโน้ม 14 วัน</div>' + H.svgLine(d.trend) + '</div>';
    var catTotal = (d.categories || []).reduce(function (s, c) { return s + (c.count || 0); }, 0);
    var chartCat = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-pie-chart-fill"></i> หนังสือตามหมวด</div>' + H.svgDonut(d.categories || [], catTotal) + '</div>';

    var topBooks = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-trophy-fill"></i> หนังสือยอดนิยม</div>'
      + (d.top_books && d.top_books.length ? d.top_books.map(function (b, i) {
        return '<a href="#/books/view?id=' + esc(b.id) + '" class="flex items-center gap-3" style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-decoration:none;color:inherit">'
          + '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,' + (i === 0 ? '#fcd34d,#f59e0b' : i === 1 ? '#e5e7eb,#9ca3af' : i === 2 ? '#fbbf24,#b45309' : '#cbd5e1,#94a3b8') + ');color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">' + (i+1) + '</div>'
          + '<div style="flex:1;min-width:0"><div class="font-bold text-sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(b.title) + '</div><div class="text-xs muted">' + esc(b.author || '') + '</div></div>'
          + '<div class="text-sm font-bold" style="color:#6366f1">' + (b.borrow_count || 0) + ' ครั้ง</div>'
          + '</a>';
      }).join('') : H.emptyState('ยังไม่มีข้อมูล', 'bi-book')) + '</div>';

    var topBorrowers = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-people-fill"></i> ผู้ยืมยอดนิยม</div>'
      + (d.top_borrowers && d.top_borrowers.length ? d.top_borrowers.map(function (b, i) {
        return '<div class="flex items-center gap-3" style="padding:8px 0;border-bottom:1px solid #f1f5f9">'
          + '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;' + H.avatarStyle(b.avatar_url) + '">' + (b.avatar_url ? '' : esc(H.initials(b.full_name))) + '</div>'
          + '<div style="flex:1;min-width:0"><div class="font-bold text-sm">' + esc(b.full_name) + '</div><div class="text-xs muted">' + esc(b.class_name || H.roleLabel(b.role)) + '</div></div>'
          + '<div class="text-sm font-bold" style="color:#10b981">' + b.count + ' ครั้ง</div>'
          + '</div>';
      }).join('') : H.emptyState('ยังไม่มีข้อมูล', 'bi-people')) + '</div>';

    var recent = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-clock-history"></i> รายการยืมล่าสุด</div>';
    if (d.recent_loans && d.recent_loans.length) {
      recent += '<div style="overflow-x:auto"><table class="data-table"><thead><tr>'
        + '<th>หนังสือ</th><th>ผู้ยืม</th><th>วันยืม</th><th>สถานะ</th></tr></thead><tbody>';
      d.recent_loans.forEach(function (l) {
        recent += '<tr class="row-clickable" data-go="#/loans/view?id=' + esc(l.id) + '">'
          + '<td><div class="text-sm font-bold">' + esc(l.book_title) + '</div></td>'
          + '<td><div class="text-sm">' + esc(l.user_name) + '</div><div class="text-xs muted">' + esc(l.user_class || '') + '</div></td>'
          + '<td>' + esc(TH.smart(l.borrowed_at)) + '</td>'
          + '<td>' + H.loanStatusBadge(l.status) + '</td>'
          + '</tr>';
      });
      recent += '</tbody></table></div>';
    } else {
      recent += H.emptyState('ยังไม่มีรายการยืม', 'bi-card-checklist');
    }
    recent += '</div>';

    var html = hero + stats
      + '<div class="sd-grid-2">' + chartTrend + chartCat + '</div>'
      + '<div class="sd-grid-2">' + topBooks + topBorrowers + '</div>'
      + recent;
    H.pageWrap(html);
    wireRowGo();
  }

  function renderUserDashboard(d) {
    var u = Store.user || {};
    var hero = H.heroHtml({
      icon: 'bi-bookmark-heart-fill',
      pill: H.roleLabel(u.role) + ' · ' + (u.class_name || ''),
      greet: H.greetByTime() + ', ' + (u.full_name || u.username),
      title: 'ห้องสมุดของฉัน',
      sub: 'หนังสือที่กำลังยืม / รายการจอง / ค่าปรับ',
      grad: 'linear-gradient(135deg,#10b981 0%,#059669 50%,#34d399 100%)',
      actions: '<a href="#/books" class="btn" style="background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.3)"><i class="bi bi-book-half"></i> เลือกหนังสือ</a>'
    });
    var stats = '<div class="sd-stagger">'
      + H.statCard({ label: 'กำลังยืม', value: d.my.active, sub: 'เล่มที่ต้องคืน', color: 'g-sky', icon: 'bi-arrow-up-circle' })
      + H.statCard({ label: 'เกินกำหนด', value: d.my.overdue, sub: 'ค่าปรับสะสม', color: 'g-rose', icon: 'bi-exclamation-triangle-fill' })
      + H.statCard({ label: 'คืนแล้ว', value: d.my.returned, sub: 'ทั้งหมด', color: 'g-emerald', icon: 'bi-check-circle-fill' })
      + H.statCard({ label: 'ค่าปรับค้าง', value: '฿' + d.my.fines_unpaid.toLocaleString(), sub: 'ต้องชำระ', color: 'g-amber', icon: 'bi-cash-coin' })
      + H.statCard({ label: 'การจอง', value: d.my.reservations, sub: 'รอรับเล่ม', color: 'g-violet', icon: 'bi-bookmark-star-fill' })
      + H.statCard({ label: 'หนังสือพร้อมยืม', value: d.books.available, sub: 'ในห้องสมุด', color: 'g-indigo', icon: 'bi-book-half' })
      + '</div>';

    var recent = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-clock-history"></i> ประวัติการยืมของฉัน</div>';
    if (d.recent_loans && d.recent_loans.length) {
      recent += '<div class="flex-col gap-3">' + d.recent_loans.map(function (l) {
        var st = l.status;
        var due = l.due_at ? new Date(l.due_at).getTime() : NaN;
        if (st === 'borrowed' && !isNaN(due) && due < Date.now()) st = 'overdue';
        return '<a href="#/loans/view?id=' + esc(l.id) + '" class="loan-card ' + (st === 'overdue' ? 'overdue' : st === 'returned' ? 'returned' : '') + '" style="text-decoration:none;color:inherit">'
          + '<div class="lc-cover" style="background-image:url(' + esc(l.book_cover || '') + ')">' + (l.book_cover ? '' : '<i class="bi bi-book"></i>') + '</div>'
          + '<div class="lc-body">'
          +   '<div class="lc-title">' + esc(l.book_title) + '</div>'
          +   '<div class="lc-meta"><span><i class="bi bi-calendar"></i> ยืม ' + esc(TH.date(l.borrowed_at)) + '</span>'
          +     '<span><i class="bi bi-clock"></i> ครบ ' + esc(TH.date(l.due_at)) + '</span></div>'
          +   '<div class="mt-2">' + H.loanStatusBadge(st) + (l.fine_amount > 0 ? ' <span class="badge b-unpaid">ค่าปรับ ฿' + l.fine_amount + '</span>' : '') + '</div>'
          + '</div></a>';
      }).join('') + '</div>';
    } else {
      recent += H.emptyState('ยังไม่มีประวัติการยืม — ลองเลือกหนังสือเล่มแรก!', 'bi-book',
        '<a href="#/books" class="btn btn-primary"><i class="bi bi-arrow-right"></i> เลือกหนังสือ</a>');
    }
    recent += '</div>';

    var popular = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-trophy-fill"></i> หนังสือยอดนิยม</div>';
    if (d.popular_books && d.popular_books.length) {
      popular += '<div class="book-grid">' + d.popular_books.map(function (b) {
        return '<a href="#/books/view?id=' + esc(b.id) + '" class="book-card" style="text-decoration:none;color:inherit">'
          + '<div class="book-cover">' + H.bookCoverHtml(b)
          +   '<div class="book-badges"><div></div>'
          +   '<div class="book-badge ' + (b.qty_available > 0 ? 'avail' : 'unavail') + '"><i class="bi bi-' + (b.qty_available > 0 ? 'check-circle' : 'x-circle') + '"></i> ' + (b.qty_available > 0 ? 'ว่าง ' + b.qty_available : 'หมด') + '</div></div>'
          + '</div>'
          + '<div class="book-info"><div class="book-title">' + esc(b.title) + '</div><div class="book-author">' + esc(b.author) + '</div>'
          + '<div class="book-meta"><span class="book-code">' + esc(b.code) + '</span><span><i class="bi bi-trophy-fill" style="color:#f59e0b"></i> ' + (b.borrow_count || 0) + '</span></div></div>'
          + '</a>';
      }).join('') + '</div>';
    } else {
      popular += H.emptyState('ยังไม่มีหนังสือยอดนิยม', 'bi-trophy');
    }
    popular += '</div>';

    H.pageWrap(hero + stats + recent + popular);
  }

  function wireRowGo() {
    $$('[data-go]').forEach(function (el) {
      el.addEventListener('click', function () {
        var h = el.getAttribute('data-go');
        if (h) location.hash = h;
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  BOOKS LIST + DETAIL
  // ═══════════════════════════════════════════════════════════
  var BOOKS_STATE = { q: '', category: '', available_only: false, sort: 'newest', page: 1 };

  Routes['#/books'] = function () {
    BOOKS_STATE.page = 1;
    renderBooksList();
  };
  Routes['#/books/view'] = function (hash) {
    var id = (hash.split('?id=')[1] || '').replace(/[^a-z0-9-]/gi, '');
    if (id) renderBookDetail(id);
  };

  function renderBooksList() {
    var hero = H.heroHtml({
      icon: 'bi-book-half', pill: 'หนังสือ', title: 'ห้องสมุดดิจิทัล',
      sub: 'ค้นหา · กรอง · ยืม-จอง ได้ทันที',
      grad: 'linear-gradient(135deg,#0ea5e9 0%,#0284c7 50%,#06b6d4 100%)'
    });
    var manage = H.hasCap('book.manage');
    var toolbar = '<div class="toolbar">'
      + '<div class="search-box"><i class="bi bi-search"></i><input class="input" placeholder="ค้นหา ชื่อ ผู้แต่ง รหัส ISBN" id="b-q" value="' + esc(BOOKS_STATE.q) + '"></div>'
      + '<select class="select" id="b-cat" style="max-width:200px"><option value="">ทุกหมวด</option></select>'
      + '<select class="select" id="b-sort" style="max-width:160px">'
      +   '<option value="newest"' + (BOOKS_STATE.sort==='newest'?' selected':'') + '>ใหม่ล่าสุด</option>'
      +   '<option value="popular"' + (BOOKS_STATE.sort==='popular'?' selected':'') + '>ยอดนิยม</option>'
      +   '<option value="title"' + (BOOKS_STATE.sort==='title'?' selected':'') + '>ชื่อ A-Z</option>'
      +   '<option value="author"' + (BOOKS_STATE.sort==='author'?' selected':'') + '>ผู้แต่ง</option>'
      + '</select>'
      + '<label class="chip" id="b-avail" style="cursor:pointer">'
      +   '<input type="checkbox" id="b-avail-cb" style="display:none"' + (BOOKS_STATE.available_only ? ' checked' : '') + '>'
      +   '<i class="bi bi-check-circle"></i> เฉพาะที่ว่าง'
      + '</label>'
      + '<button class="btn btn-ghost btn-sm" id="b-clear"><i class="bi bi-x-circle"></i> ล้าง</button>'
      + (manage ? '<button class="btn btn-primary" id="b-new" style="margin-left:auto"><i class="bi bi-plus-lg"></i> เพิ่มหนังสือ</button>' : '')
      + '</div>';
    var chips = '<div id="b-cat-chips" class="flex gap-2" style="overflow-x:auto;padding-bottom:8px;flex-wrap:wrap;margin-bottom:10px"></div>';
    var grid = '<div id="books-grid">' + H.skBlock(80) + H.skBlock(80) + '</div>';
    var pag = '<div id="books-pag" style="margin-top:14px;text-align:center"></div>';
    H.pageWrap(hero + toolbar + chips + grid + pag);

    // Load categories chips + select
    window.call('book.categories', {}).then(function (data) {
      if (!$('#b-cat')) return;
      var items = data.items || [];
      $('#b-cat').innerHTML = '<option value="">ทุกหมวด</option>' + items.map(function (c) {
        return '<option value="' + esc(c.key) + '"' + (BOOKS_STATE.category === c.key ? ' selected' : '') + '>' + esc(c.label) + ' (' + c.count + ')</option>';
      }).join('');
      $('#b-cat-chips').innerHTML = '<button class="chip ' + (BOOKS_STATE.category === '' ? 'active' : '') + '" data-cat="">ทั้งหมด</button>'
        + items.map(function (c) {
          return '<button class="chip ' + (BOOKS_STATE.category === c.key ? 'active' : '') + '" data-cat="' + esc(c.key) + '"><i class="bi ' + esc(c.icon) + '"></i> ' + esc(c.label) + ' <span class="muted">(' + c.count + ')</span></button>';
        }).join('');
      $$('#b-cat-chips .chip').forEach(function (el) {
        el.addEventListener('click', function () {
          BOOKS_STATE.category = el.getAttribute('data-cat') || '';
          BOOKS_STATE.page = 1;
          renderBooksList();
        });
      });
    }).catch(function () {});

    // Wire toolbar
    var debounceTimer = null;
    $('#b-q').addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        BOOKS_STATE.q = $('#b-q').value.trim();
        BOOKS_STATE.page = 1;
        loadBooks();
      }, 300);
    });
    $('#b-cat').addEventListener('change', function () {
      BOOKS_STATE.category = $('#b-cat').value;
      BOOKS_STATE.page = 1;
      renderBooksList();
    });
    $('#b-sort').addEventListener('change', function () {
      BOOKS_STATE.sort = $('#b-sort').value;
      BOOKS_STATE.page = 1;
      loadBooks();
    });
    $('#b-avail').addEventListener('click', function (e) {
      if (e.target.id === 'b-avail-cb') return;
      var cb = $('#b-avail-cb');
      cb.checked = !cb.checked;
      BOOKS_STATE.available_only = cb.checked;
      $('#b-avail').classList.toggle('active', cb.checked);
      BOOKS_STATE.page = 1;
      loadBooks();
    });
    if (BOOKS_STATE.available_only) $('#b-avail').classList.add('active');
    $('#b-clear').addEventListener('click', function () {
      BOOKS_STATE = { q: '', category: '', available_only: false, sort: 'newest', page: 1 };
      renderBooksList();
    });
    if (manage) {
      var nb = $('#b-new');
      if (nb) nb.addEventListener('click', function () { openBookEditModal(null); });
    }
    loadBooks();
  }

  function loadBooks() {
    var grid = $('#books-grid');
    if (!grid) return;
    grid.innerHTML = H.skBlock(120) + H.skBlock(120);
    window.call('book.list', {
      q: BOOKS_STATE.q, category: BOOKS_STATE.category,
      available_only: BOOKS_STATE.available_only,
      sort: BOOKS_STATE.sort, page: BOOKS_STATE.page, per_page: 24
    }).then(function (data) {
      if (!$('#books-grid')) return;
      if (!data.items.length) {
        $('#books-grid').innerHTML = H.emptyState('ไม่พบหนังสือตามเงื่อนไข', 'bi-search');
        $('#books-pag').innerHTML = '';
        return;
      }
      var manage = H.hasCap('book.manage');
      var html = '<div class="book-grid">' + data.items.map(function (b) {
        return '<div class="book-card" data-go="#/books/view?id=' + esc(b.id) + '">'
          + '<div class="book-cover">' + H.bookCoverHtml(b)
          +   '<div class="book-badges">'
          +     '<div class="book-badge"><i class="bi bi-bookmark"></i> ' + esc(b.code) + '</div>'
          +     '<div class="book-badge ' + (b.qty_available > 0 ? 'avail' : 'unavail') + '"><i class="bi bi-' + (b.qty_available > 0 ? 'check-circle' : 'x-circle') + '"></i> ' + (b.qty_available > 0 ? 'ว่าง ' + b.qty_available : 'หมด') + '</div>'
          +   '</div>'
          + '</div>'
          + '<div class="book-info">'
          +   '<div class="book-title">' + esc(b.title) + '</div>'
          +   '<div class="book-author">' + esc(b.author) + '</div>'
          +   '<div class="book-meta"><span>' + esc(b.publisher || '') + '</span><span><i class="bi bi-trophy" style="color:#f59e0b"></i> ' + (b.borrow_count || 0) + '</span></div>'
          + '</div>'
          + '</div>';
      }).join('') + '</div>';
      $('#books-grid').innerHTML = html;
      wireRowGo();
      // Pagination
      var pag = '';
      if (data.pages > 1) {
        pag = '<div class="flex justify-center gap-2 items-center">';
        if (data.page > 1) pag += '<button class="btn btn-sm" data-pg="' + (data.page - 1) + '"><i class="bi bi-chevron-left"></i></button>';
        pag += '<span class="text-sm muted">หน้า ' + data.page + ' / ' + data.pages + ' (รวม ' + data.total + ')</span>';
        if (data.page < data.pages) pag += '<button class="btn btn-sm" data-pg="' + (data.page + 1) + '"><i class="bi bi-chevron-right"></i></button>';
        pag += '</div>';
      } else {
        pag = '<span class="text-sm muted">แสดงทั้งหมด ' + data.total + ' รายการ</span>';
      }
      $('#books-pag').innerHTML = pag;
      $$('#books-pag [data-pg]').forEach(function (b) {
        b.addEventListener('click', function () {
          BOOKS_STATE.page = parseInt(b.getAttribute('data-pg'), 10);
          loadBooks();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function renderBookDetail(id) {
    H.pageWrap(H.skBlock(280));
    window.call('book.get', { id: id }).then(function (data) {
      if (!$('#page')) return;
      var b = data.book;
      var manage = H.hasCap('book.manage');
      var canBorrow = H.hasCap('loan.create_own') || H.hasCap('loan.manage');
      var canReserve = H.hasCap('reservation.create_own') || H.hasCap('reservation.manage');
      var available = (b.qty_available || 0) > 0;

      var hero = '<div class="sd-hero" style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)">'
        + '<div class="flex items-center gap-3"><a href="#/books" class="btn btn-sm" style="background:rgba(255,255,255,.18);color:#fff;border-color:transparent;backdrop-filter:blur(6px)"><i class="bi bi-arrow-left"></i> กลับ</a></div>'
        + '<div class="sd-hero-title" style="margin-top:14px">' + esc(b.title) + '</div>'
        + '<div class="sd-hero-sub">' + esc(b.author) + '</div>'
        + '</div>';

      var actions = '';
      if (canBorrow && available) {
        actions += '<button class="btn btn-success btn-lg" id="bd-borrow"><i class="bi bi-arrow-up-circle"></i> ยืมเล่มนี้</button>';
      }
      if (canReserve) {
        actions += '<button class="btn btn-warning btn-lg" id="bd-reserve"><i class="bi bi-bookmark-star-fill"></i> จองเล่มนี้</button>';
      }
      actions += '<button class="btn btn-lg" id="bd-qr"><i class="bi bi-qr-code"></i> QR Code</button>';
      if (manage) {
        actions += '<button class="btn btn-lg" id="bd-edit"><i class="bi bi-pencil"></i> แก้ไข</button>';
        actions += '<button class="btn btn-lg btn-danger" id="bd-del"><i class="bi bi-trash"></i> ลบ</button>';
      }

      var cover = b.cover_url
        ? '<img src="' + esc(b.cover_url) + '" referrerpolicy="no-referrer" style="width:100%;border-radius:14px;aspect-ratio:3/4;object-fit:cover">'
        : '<div style="width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:48px"><i class="bi bi-book-half"></i></div>';

      var detail = '<div style="display:grid;grid-template-columns:240px 1fr;gap:20px;align-items:start" class="book-detail-grid">'
        + '<div>' + cover + '</div>'
        + '<div class="flex-col gap-3">'
        +   '<div class="flex gap-2" style="flex-wrap:wrap">' + actions + '</div>'
        +   '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-info-circle"></i> ข้อมูลหนังสือ</div>'
        +     '<table style="width:100%;font-size:13px"><tbody>'
        +     '<tr><td class="muted" style="padding:4px 0;width:120px">รหัส</td><td class="font-mono font-bold">' + esc(b.code) + '</td></tr>'
        +     '<tr><td class="muted" style="padding:4px 0">ISBN</td><td>' + esc(b.isbn || '-') + '</td></tr>'
        +     '<tr><td class="muted" style="padding:4px 0">ผู้แต่ง</td><td>' + esc(b.author) + '</td></tr>'
        +     '<tr><td class="muted" style="padding:4px 0">สำนักพิมพ์</td><td>' + esc(b.publisher || '-') + '</td></tr>'
        +     '<tr><td class="muted" style="padding:4px 0">ปีที่พิมพ์</td><td>' + esc(b.pub_year || '-') + '</td></tr>'
        +     '<tr><td class="muted" style="padding:4px 0">ภาษา</td><td>' + esc(b.language || '-') + '</td></tr>'
        +     '<tr><td class="muted" style="padding:4px 0">ที่จัดเก็บ</td><td>' + esc(b.location || '-') + '</td></tr>'
        +     '<tr><td class="muted" style="padding:4px 0">จำนวน</td><td><b>' + esc(b.qty_available) + ' / ' + esc(b.qty_total) + '</b> เล่ม</td></tr>'
        +     '<tr><td class="muted" style="padding:4px 0">ยืมไปแล้ว</td><td><b style="color:#f59e0b">' + (b.borrow_count || 0) + '</b> ครั้ง</td></tr>'
        +     '</tbody></table>'
        +   '</div>'
        +   (b.description ? '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-card-text"></i> รายละเอียด</div><div class="text-sm" style="line-height:1.7;white-space:pre-wrap">' + esc(b.description) + '</div></div>' : '')
        + '</div>'
        + '</div>'
        + '<style>@media(max-width:720px){.book-detail-grid{grid-template-columns:1fr!important}}</style>';

      var recent = '';
      if (data.recent_loans && data.recent_loans.length) {
        recent = '<div class="sd-panel mt-4"><div class="sd-panel-title"><i class="bi bi-clock-history"></i> ประวัติการยืมล่าสุด</div>'
          + '<div style="overflow-x:auto"><table class="data-table"><thead><tr><th>ผู้ยืม</th><th>วันยืม</th><th>วันคืน</th><th>สถานะ</th></tr></thead><tbody>'
          + data.recent_loans.map(function (l) {
            return '<tr><td><div>' + esc(l.user_name) + '</div><div class="text-xs muted">' + esc(l.user_class || '') + '</div></td>'
              + '<td>' + esc(TH.date(l.borrowed_at)) + '</td>'
              + '<td>' + (l.returned_at ? esc(TH.date(l.returned_at)) : '-') + '</td>'
              + '<td>' + H.loanStatusBadge(l.status) + '</td></tr>';
          }).join('')
          + '</tbody></table></div></div>';
      }

      H.pageWrap(hero + detail + recent);

      // Wire actions
      if ($('#bd-borrow')) $('#bd-borrow').addEventListener('click', function () { openBorrowModal(b); });
      if ($('#bd-reserve')) $('#bd-reserve').addEventListener('click', function () { reserveBook(b); });
      if ($('#bd-qr')) $('#bd-qr').addEventListener('click', function () { openBookQrModal(b); });
      if ($('#bd-edit')) $('#bd-edit').addEventListener('click', function () { openBookEditModal(b); });
      if ($('#bd-del')) $('#bd-del').addEventListener('click', function () {
        confirmModal({
          title: 'ลบหนังสือ', message: 'ลบ "' + b.title + '" ออกจากระบบ? (จะลบไม่ได้ถ้ามีการยืมค้างอยู่)',
          danger: true, okText: 'ลบ'
        }).then(function (ok) {
          if (!ok) return;
          window.call('book.delete', { id: b.id }).then(function () {
            alertSuccess('ลบเรียบร้อย');
            location.hash = '#/books';
          }).catch(function (e) { alertError('ลบไม่สำเร็จ', e.message); });
        });
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  // สร้าง URL รูป QR จาก API (ไม่ต้องพึ่ง JS library — แสดงได้เสมอ)
  function qrImageUrl(data, size) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size
      + '&margin=10&color=1e293b&bgcolor=ffffff&data=' + encodeURIComponent(data);
  }

  function openBookQrModal(b) {
    var qrData = 'SLS:BK:' + b.code;
    var imgUrl = qrImageUrl(qrData, 480);
    Modal.open({
      title: 'QR Code · ' + b.title,
      titleIcon: 'bi-qr-code',
      html: '<div class="qr-box">'
        + '<div id="qr-canvas" class="qr-canvas" style="min-height:240px;display:flex;align-items:center;justify-content:center">'
        +   '<div class="sk sk-block" style="width:240px;height:240px;border-radius:12px" id="qr-loading"></div>'
        + '</div>'
        + '<div class="qr-code-text">' + esc(b.code) + '</div>'
        + '<div class="text-xs muted text-center">สแกน QR เพื่อยืม-คืนหนังสือเล่มนี้</div>'
        + '<div class="flex gap-2 mt-3" style="flex-wrap:wrap;justify-content:center">'
        +   '<button class="btn btn-primary" id="qr-print"><i class="bi bi-printer"></i> พิมพ์</button>'
        +   '<button class="btn" id="qr-download"><i class="bi bi-download"></i> ดาวน์โหลด</button>'
        + '</div>'
        + '</div>',
      footer: '<button class="btn" data-modal-close type="button">ปิด</button>',
      onOpen: function (host) {
        var box = $('#qr-canvas', host);

        function wireButtons(getPngUrl) {
          $('#qr-download', host).onclick = function () {
            getPngUrl(function (url) {
              if (!url) { window.open(imgUrl, '_blank'); return; }
              var link = document.createElement('a');
              link.download = 'QR-' + b.code + '.png';
              link.href = url;
              link.click();
            });
          };
          $('#qr-print', host).onclick = function () {
            getPngUrl(function (url) {
              var src = url || imgUrl;
              var w = window.open('', '_blank', 'width=400,height=540');
              if (!w) { toast('โปรดอนุญาต popup', 'warning'); return; }
              w.document.write('<!DOCTYPE html><html><head><title>QR ' + esc(b.code) + '</title>'
                + '<style>body{font-family:Kanit,sans-serif;text-align:center;padding:20px}'
                + 'img{max-width:280px;margin:14px 0}h2{font-size:16px;margin:4px 0}p{margin:2px;font-size:12px;color:#475569}.c{font-family:monospace;font-size:18px;font-weight:700;color:#6366f1}</style></head><body>'
                + '<h2>' + esc(b.title) + '</h2>'
                + '<p>' + esc(b.author) + '</p>'
                + '<img src="' + src + '" onload="setTimeout(function(){window.print()},250)">'
                + '<div class="c">' + esc(b.code) + '</div>'
                + '<p>' + esc((Store.boot.app && Store.boot.app.name) || '') + '</p>'
                + '</body></html>');
              w.document.close();
            });
          };
        }

        // ── แผน A: รูปจาก QR API ──
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
          box.innerHTML = '';
          img.style.width = '240px';
          img.style.height = '240px';
          img.style.borderRadius = '10px';
          box.appendChild(img);
          wireButtons(function (cb) {
            try {
              var c = document.createElement('canvas');
              c.width = img.naturalWidth; c.height = img.naturalHeight;
              c.getContext('2d').drawImage(img, 0, 0);
              cb(c.toDataURL('image/png'));
            } catch (e) { cb(null); }
          });
        };
        img.onerror = function () {
          // ── แผน B: JS library (CDN) ──
          loadQRLib().then(function (QRC) {
            var c = document.createElement('canvas');
            QRC.toCanvas(c, qrData, { width: 240, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e293b', light: '#ffffff' } }, function (err) {
              if (err) { box.innerHTML = '<div class="empty-state">สร้าง QR ไม่สำเร็จ — ใช้รหัสด้านล่างแทน</div>'; return; }
              box.innerHTML = '';
              box.appendChild(c);
              wireButtons(function (cb) { try { cb(c.toDataURL('image/png')); } catch (e) { cb(null); } });
            });
          }).catch(function () {
            box.innerHTML = '<div class="text-center" style="padding:20px"><i class="bi bi-wifi-off" style="font-size:32px;color:#f43f5e"></i><div class="text-xs muted mt-2">สร้าง QR ไม่ได้ (อินเทอร์เน็ตถูกจำกัด)<br>ใช้รหัสหนังสือด้านล่างกรอกแทนได้</div></div>';
            wireButtons(function (cb) { cb(null); });
          });
        };
        img.src = imgUrl;
      }
    });
  }

  function openBookEditModal(b) {
    var isEdit = !!b;
    window.call('category.list', {}).then(function (cd) {
      var cats = cd.items || [];
      var catOpts = cats.map(function (c) {
        return '<option value="' + esc(c.key) + '"' + (b && b.category_key === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>';
      }).join('');
      Modal.open({
        title: isEdit ? 'แก้ไขหนังสือ' : 'เพิ่มหนังสือใหม่',
        titleIcon: isEdit ? 'bi-pencil-square' : 'bi-plus-circle',
        large: true,
        html: '<form id="bk-form">'
          + '<div class="field-row">'
          +   '<div class="field"><label>รหัสหนังสือ<span class="req">*</span></label><input class="input" name="code" value="' + esc(b ? b.code : '') + '" placeholder="ปล่อยว่าง = สร้างอัตโนมัติ"></div>'
          +   '<div class="field"><label>ISBN</label><input class="input" name="isbn" value="' + esc(b ? b.isbn : '') + '"></div>'
          + '</div>'
          + '<div class="field"><label>ชื่อหนังสือ<span class="req">*</span></label><input class="input" name="title" required value="' + esc(b ? b.title : '') + '"></div>'
          + '<div class="field-row">'
          +   '<div class="field"><label>ผู้แต่ง<span class="req">*</span></label><input class="input" name="author" required value="' + esc(b ? b.author : '') + '"></div>'
          +   '<div class="field"><label>หมวด<span class="req">*</span></label><select class="select" name="category_key" required><option value="">-- เลือก --</option>' + catOpts + '</select></div>'
          + '</div>'
          + '<div class="field-row-3">'
          +   '<div class="field"><label>สำนักพิมพ์</label><input class="input" name="publisher" value="' + esc(b ? b.publisher : '') + '"></div>'
          +   '<div class="field"><label>ปีที่พิมพ์</label><input class="input" name="pub_year" value="' + esc(b ? b.pub_year : '') + '"></div>'
          +   '<div class="field"><label>ภาษา</label><select class="select" name="language"><option value="th"' + (b && b.language === 'th' ? ' selected' : '') + '>ไทย</option><option value="en"' + (b && b.language === 'en' ? ' selected' : '') + '>อังกฤษ</option><option value="other"' + (b && b.language === 'other' ? ' selected' : '') + '>อื่นๆ</option></select></div>'
          + '</div>'
          + '<div class="field-row-3">'
          +   '<div class="field"><label>จำนวนทั้งหมด<span class="req">*</span></label><input class="input" type="number" min="1" name="qty_total" required value="' + esc(b ? b.qty_total : '1') + '"></div>'
          +   '<div class="field"><label>จำนวนพร้อมยืม</label><input class="input" type="number" min="0" name="qty_available" value="' + esc(b ? b.qty_available : '1') + '"></div>'
          +   '<div class="field"><label>ที่จัดเก็บ</label><input class="input" name="location" placeholder="A1-01" value="' + esc(b ? b.location : '') + '"></div>'
          + '</div>'
          + '<div class="field"><label>ปก (URL หรืออัปโหลด)</label>'
          +   '<div class="flex gap-2 items-center" style="flex-wrap:wrap">'
          +     '<input class="input" name="cover_url" value="' + esc(b ? b.cover_url : '') + '" placeholder="https://...">'
          +     '<input type="file" id="bk-cover-file" accept="image/*" style="display:none">'
          +     '<button type="button" class="btn" id="bk-cover-btn"><i class="bi bi-upload"></i> เลือกไฟล์</button>'
          +   '</div>'
          + '</div>'
          + '<div class="field"><label>คำอธิบาย</label><textarea class="textarea" name="description">' + esc(b ? b.description : '') + '</textarea></div>'
          + '<div class="field"><label>แท็ก (คั่นด้วย ,)</label><input class="input" name="tags" value="' + esc(b ? b.tags : '') + '" placeholder="แท็ก1, แท็ก2"></div>'
          + (isEdit ? '<div class="field"><label class="lf-check" style="display:inline-flex;color:#475569"><input type="checkbox" name="is_active" ' + (b && b.is_active !== 'no' ? 'checked' : '') + '><span class="lf-check-box"></span><span>เปิดใช้งาน</span></label></div>' : '')
          + '</form>',
        footer: '<button class="btn" data-modal-close type="button">ยกเลิก</button>'
          + '<button class="btn btn-primary" type="button" id="bk-save"><i class="bi bi-check-circle"></i> บันทึก</button>',
        onOpen: function (host) {
          var fileInput = $('#bk-cover-file', host);
          $('#bk-cover-btn', host).addEventListener('click', function () { fileInput.click(); });
          fileInput.addEventListener('change', function () {
            if (!fileInput.files.length) return;
            Spinner.show('กำลังอัปโหลดปกหนังสือ', { stages: ['ตรวจไฟล์', 'อัปโหลด', 'บันทึก'] });
            H.uploadFile(fileInput.files[0], 'books').then(function (r) {
              Spinner.hide();
              host.querySelector('input[name="cover_url"]').value = r.url;
              toast('อัปโหลดปกสำเร็จ', 'success');
            }).catch(function (e) {
              Spinner.hide();
              toast(e.message, 'error');
            });
          });
          $('#bk-save', host).addEventListener('click', function () {
            var f = $('#bk-form', host);
            var data = {};
            ['code','isbn','title','author','category_key','publisher','pub_year','language','qty_total','qty_available','location','cover_url','description','tags'].forEach(function (k) {
              data[k] = f[k] ? f[k].value : '';
            });
            data.qty_total = parseInt(data.qty_total, 10) || 1;
            data.qty_available = parseInt(data.qty_available, 10);
            if (isEdit) {
              data.id = b.id;
              data.is_active = f.is_active.checked;
            }
            if (!data.title || !data.author || !data.category_key) return toast('กรอกข้อมูลให้ครบ', 'warning');
            Spinner.show(isEdit ? 'กำลังอัปเดต' : 'กำลังเพิ่มหนังสือ', { stages: ['ตรวจสอบ', 'บันทึก', 'รีเฟรช'] });
            window.call('book.upsert', data).then(function () {
              Spinner.hide();
              Modal.close();
              alertSuccess(isEdit ? 'อัปเดตเรียบร้อย' : 'เพิ่มหนังสือเรียบร้อย');
              if (location.hash.indexOf('#/books/view') === 0) renderBookDetail(b.id);
              else renderBooksList();
            }).catch(function (e) {
              Spinner.hide();
              alertError('บันทึกไม่สำเร็จ', e.message);
            });
          });
        }
      });
    }).catch(function () {});
  }

  // ═══════════════════════════════════════════════════════════
  //  BORROW MODAL (User scope; staff scope from #/borrow page)
  // ═══════════════════════════════════════════════════════════
  function openBorrowModal(b) {
    // For students/teachers - borrow for self
    // For librarian/admin - select user
    var isStaff = H.hasCap('loan.manage');
    var settings = Store.boot.settings || {};
    var defaultDays = parseInt(settings.max_borrow_days, 10) || 7;
    var dueDate = new Date(Date.now() + defaultDays * 24 * 3600 * 1000);

    var userPicker = '';
    if (isStaff) {
      userPicker = '<div class="field bo-user-picker"><label>ผู้ยืม<span class="req">*</span></label>'
        + '<div style="display:flex;gap:8px;align-items:stretch">'
        +   '<button type="button" class="btn" id="bo-user-scan" title="สแกน QR บัตรนักเรียน" style="min-width:52px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:transparent;box-shadow:0 4px 12px rgba(99,102,241,.35)"><i class="bi bi-qr-code-scan" style="font-size:18px"></i></button>'
        +   '<div style="position:relative;flex:1;min-width:0">'
        +     '<input type="text" class="input" id="bo-user-search" placeholder="สแกนบัตร หรือพิมพ์ชื่อ, username, รหัส..." autocomplete="off">'
        +     '<input type="hidden" name="user_id" required id="bo-user-id">'
        +     '<i class="bi bi-search" style="position:absolute; right:12px; top:12px; color:#94a3b8; pointer-events:none;"></i>'
        +     '<div id="bo-user-dropdown" class="bo-user-dropdown" style="display:none;"></div>'
        +   '</div>'
        + '</div></div>';
    }

    Modal.open({
      title: 'ยืมหนังสือ',
      titleIcon: 'bi-arrow-up-circle',
      html: '<div class="flex gap-3 mb-4" style="padding:14px;background:linear-gradient(135deg,#f0fdf4,#fff);border:1px solid #86efac;border-radius:14px">'
        + (b.cover_url ? '<img src="' + esc(b.cover_url) + '" style="width:50px;height:70px;border-radius:8px;object-fit:cover" referrerpolicy="no-referrer">' : '<div style="width:50px;height:70px;border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;color:#fff"><i class="bi bi-book"></i></div>')
        + '<div style="flex:1;min-width:0">'
        +   '<div class="font-bold text-sm">' + esc(b.title) + '</div>'
        +   '<div class="text-xs muted">' + esc(b.author) + '</div>'
        +   '<div class="text-xs mt-2"><span class="badge b-borrowed">' + esc(b.code) + '</span> <span class="badge b-active">ว่าง ' + b.qty_available + ' เล่ม</span></div>'
        + '</div></div>'
        + '<form id="bo-form">'
        + userPicker
        + '<div class="field"><label>จำนวนวัน</label>'
        +   '<input class="input" name="days" type="number" min="1" max="60" value="' + defaultDays + '">'
        +   '<div class="field-hint">ครบกำหนดคืน: <span id="bo-due">' + TH.dateLong(dueDate) + '</span></div>'
        + '</div>'
        + '<div class="field"><label>หมายเหตุ</label><textarea class="textarea" name="notes" rows="2"></textarea></div>'
        + '</form>',
      footer: '<button class="btn" data-modal-close type="button">ยกเลิก</button>'
        + '<button class="btn btn-success" type="button" id="bo-submit"><i class="bi bi-check-circle"></i> ยืนยันยืม</button>',
      onOpen: function (host) {
        var f = $('#bo-form', host);
        // Update due display when days change
        f.days.addEventListener('input', function () {
          var dd = parseInt(f.days.value, 10) || 1;
          var dt = new Date(Date.now() + dd * 24 * 3600 * 1000);
          $('#bo-due', host).textContent = TH.dateLong(dt);
        });
        // Smart User Picker logic for staff
        if (isStaff) {
          var searchInput = $('#bo-user-search', host);
          var idInput = $('#bo-user-id', host);
          var dropdown = $('#bo-user-dropdown', host);
          var debounceTimer;

          function renderUserList(items) {
            if (!items || !items.length) {
              dropdown.innerHTML = '<div style="padding:12px; text-align:center; color:#64748b; font-size:13px;"><i class="bi bi-emoji-frown"></i> ไม่พบผู้ใช้</div>';
              dropdown.style.display = 'block';
              return;
            }
            dropdown.innerHTML = items.slice(0, 15).map(function(u) {
              return '<button type="button" class="bo-user-item" data-id="' + esc(u.id) + '" data-name="' + esc(u.full_name) + '">'
                + '<div class="bo-user-item-av" style="' + H.avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(H.initials(u.full_name))) + '</div>'
                + '<div class="bo-user-item-info">'
                +   '<div class="bo-user-item-name">' + esc(u.full_name) + '</div>'
                +   '<div class="bo-user-item-meta">' + esc(u.username) + (u.class_name ? ' · ' + esc(u.class_name) : '') + '</div>'
                + '</div>'
                + '<div class="bo-user-item-role"><span class="role-chip role-chip-' + esc(u.role) + '"><i class="bi bi-shield-check-fill"></i>' + esc(H.roleLabel(u.role)) + '</span></div>'
                + '</button>';
            }).join('');
            dropdown.style.display = 'block';

            $$('.bo-user-item', dropdown).forEach(function(btn) {
              btn.addEventListener('click', function() {
                searchInput.value = btn.getAttribute('data-name');
                idInput.value = btn.getAttribute('data-id');
                dropdown.style.display = 'none';
              });
            });
          }

          searchInput.addEventListener('input', function() {
            var q = searchInput.value.trim();
            idInput.value = ''; // clear selection if typing
            clearTimeout(debounceTimer);
            if (!q) {
              dropdown.style.display = 'none';
              return;
            }
            dropdown.innerHTML = '<div style="padding:12px; text-align:center; color:#64748b; font-size:13px;"><i class="bi bi-hourglass-split"></i> กำลังค้นหา...</div>';
            dropdown.style.display = 'block';
            debounceTimer = setTimeout(function() {
              window.call('user.list', { q: q, active_only: true }).then(function(data) {
                renderUserList(data.items);
              }).catch(function() {
                dropdown.style.display = 'none';
              });
            }, 300);
          });

          searchInput.addEventListener('focus', function() {
            if (searchInput.value.trim() && !idInput.value) {
              searchInput.dispatchEvent(new Event('input'));
            }
          });

          // Close on click outside
          document.addEventListener('click', function(e) {
            if (searchInput && dropdown && !searchInput.contains(e.target) && !dropdown.contains(e.target)) {
              dropdown.style.display = 'none';
            }
          }, { capture: true });

          // สแกน QR บัตรนักเรียน → เลือกผู้ยืมอัตโนมัติ
          var scanBtn = $('#bo-user-scan', host);
          if (scanBtn) scanBtn.addEventListener('click', function () {
            if (!window.SLS_openCamOverlay) return toast('ตัวสแกนยังไม่พร้อม', 'warning');
            window.SLS_openCamOverlay(function (text) {
              var code = String(text).replace(/^SLS:U:/i, '').trim();
              if (!code) return;
              searchInput.value = code;
              dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:#64748b;font-size:13px"><i class="bi bi-hourglass-split"></i> กำลังค้นหาจากบัตร...</div>';
              dropdown.style.display = 'block';
              window.call('user.list', { q: code, active_only: true }).then(function (data) {
                var items = data.items || [];
                var lc = code.toLowerCase();
                var exact = items.filter(function (x) {
                  return String(x.username).toLowerCase() === lc || String(x.student_no) === code;
                });
                var u = exact[0] || (items.length === 1 ? items[0] : null);
                if (u) {
                  searchInput.value = u.full_name;
                  idInput.value = u.id;
                  dropdown.style.display = 'none';
                  toast('เลือก ' + u.full_name + (u.class_name ? ' (' + u.class_name + ')' : '') + ' แล้ว', 'success', 2200);
                } else if (items.length) {
                  renderUserList(items);
                } else {
                  dropdown.style.display = 'none';
                  toast('ไม่พบสมาชิกจากบัตรนี้', 'error');
                }
              }).catch(function (e) {
                dropdown.style.display = 'none';
                toast(e.message, 'error');
              });
            });
          });
        }
        $('#bo-submit', host).addEventListener('click', function () {
          var data = { book_id: b.id, days: parseInt(f.days.value, 10) || defaultDays, notes: f.notes.value };
          if (isStaff) {
            var uid = f.user_id.value;
            if (!uid) return toast('เลือกผู้ยืม', 'warning');
            data.user_id = uid;
          }
          Spinner.show('กำลังบันทึกการยืม', { stages: ['ตรวจสอบสิทธิ์', 'จองเล่ม', 'บันทึก', 'เสร็จสิ้น'] });
          window.call('loan.borrow', data).then(function (r) {
            Spinner.hide();
            Modal.close();
            Swal.fire({
              icon: 'success', title: 'ยืมสำเร็จ!',
              html: '<div style="font-size:14px;margin-top:6px">รหัสยืม: <b>' + esc(r.loan.code) + '</b></div>'
                + '<div style="font-size:13px;color:#64748b;margin-top:6px">ครบกำหนดคืน: <b style="color:#1e293b">' + esc(TH.dateLong(r.loan.due_at)) + '</b></div>',
              timer: 2500, showConfirmButton: false, timerProgressBar: true
            });
            if (location.hash === '#/books') renderBooksList();
            else if (location.hash.indexOf('#/books/view') === 0) renderBookDetail(b.id);
            else if (location.hash.indexOf('#/borrow') === 0) {
              var inputCode = document.getElementById('bw-borrow-code');
              var resultBox = document.getElementById('bw-borrow-result');
              var clearBtn  = document.getElementById('bw-borrow-clear');
              if (inputCode) { inputCode.value = ''; inputCode.focus(); }
              if (resultBox) { resultBox.innerHTML = ''; }
              if (clearBtn) { clearBtn.hidden = true; }
              setTimeout(function () {
                if (location.hash.indexOf('#/borrow') === 0) renderBorrowWorkstation();
              }, 1800);
            }
          }).catch(function (e) {
            Spinner.hide();
            alertError('ยืมไม่สำเร็จ', e.message);
          });
        });
      }
    });
  }

  function reserveBook(b) {
    confirmModal({
      title: 'จองหนังสือ', message: 'จอง "' + b.title + '"? ระบบจะจองให้คุณตามนโยบายของห้องสมุด',
      okText: 'จอง', cancelText: 'ยกเลิก'
    }).then(function (ok) {
      if (!ok) return;
      Spinner.show('กำลังจองหนังสือ', { stages: ['ตรวจสอบ', 'สร้างการจอง', 'เสร็จสิ้น'] });
      window.call('reservation.create', { book_id: b.id }).then(function () {
        Spinner.hide();
        alertSuccess('จองสำเร็จ', 'การจองมีอายุ ' + (Store.boot.settings.reserve_hold_days || '2') + ' วัน');
      }).catch(function (e) {
        Spinner.hide();
        alertError('จองไม่สำเร็จ', e.message);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  BORROW-RETURN PRO WORKSTATION
  // ═══════════════════════════════════════════════════════════
  var BW_STATE = { mode: 'borrow', scanner: null, dirty: false };

  // Sound feedback (data URI WAV — tiny beep)
  function playBeep(type) {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = type === 'error' ? 200 : (type === 'success' ? 880 : 660);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  }

  // Lazy load html5-qrcode for camera scanning
  var __HTML5QR_PROMISE = null;
  function loadQRScanner() {
    if (typeof Html5Qrcode !== 'undefined') return Promise.resolve(Html5Qrcode);
    if (__HTML5QR_PROMISE) return __HTML5QR_PROMISE;
    var sources = [
      'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
      'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
    ];
    __HTML5QR_PROMISE = new Promise(function (resolve, reject) {
      function tryLoad(idx) {
        if (typeof Html5Qrcode !== 'undefined') return resolve(Html5Qrcode);
        if (idx >= sources.length) { __HTML5QR_PROMISE = null; return reject(new Error('โหลด QR scanner ไม่สำเร็จ')); }
        var s = document.createElement('script');
        s.src = sources[idx]; s.async = true; s.crossOrigin = 'anonymous';
        s.onload = function () { if (typeof Html5Qrcode !== 'undefined') resolve(Html5Qrcode); else tryLoad(idx + 1); };
        s.onerror = function () { tryLoad(idx + 1); };
        document.head.appendChild(s);
      }
      tryLoad(0);
    });
    return __HTML5QR_PROMISE;
  }

  Routes['#/borrow'] = function () {
    if (!H.hasCap('loan.manage')) { toast('คุณไม่มีสิทธิ์ใช้งาน', 'warning'); location.hash = '#/dashboard'; return; }
    renderBorrowWorkstation();
  };

  function renderBorrowWorkstation() {
    H.pageWrap(borrowHeroSkeleton() + H.skBlock(220));
    // Load KPI + recent activity + pending returns + overdue in parallel
    Promise.all([
      window.call('report.dashboard', {}),
      window.call('loan.list', { status: 'borrowed', per_page: 30 })
    ]).then(function (results) {
      if (!$('#page')) return;
      var dash = results[0];
      var pendingData = results[1];
      renderBorrowFull(dash, pendingData);
    }).catch(function (e) {
      toast(e.message, 'error');
      renderBorrowFull({ books: {}, loans: {}, fines: {} }, { items: [] });
    });
  }

  function borrowHeroSkeleton() {
    return '<div class="bw-hero"><div class="bw-hero-inner">'
      + '<div class="bw-hero-pill"><i class="bi bi-arrow-left-right"></i> ยืม-คืน</div>'
      + '<div class="bw-hero-title">ระบบยืม-คืนหนังสือ</div>'
      + '<div class="bw-hero-sub">สแกน QR Code · จัดการยืม-คืน · ดูสถานะแบบเรียลไทม์</div>'
      + '</div></div>';
  }

  function renderBorrowFull(dash, pending) {
    var loans = (dash && dash.loans) || {};
    var fines = (dash && dash.fines) || {};
    var books = (dash && dash.books) || {};
    var nowMs = Date.now();
    var todayKey = TH.iso(new Date());
    var todayBorrowed = (dash && dash.trend && dash.trend.length) ? (dash.trend[dash.trend.length - 1].borrowed || 0) : 0;
    var todayReturned = (dash && dash.trend && dash.trend.length) ? (dash.trend[dash.trend.length - 1].returned || 0) : 0;

    // Overdue + due-today from pending
    var items = (pending && pending.items) || [];
    var overdue = [], dueToday = [], normal = [];
    items.forEach(function (l) {
      var due = l.due_at ? new Date(l.due_at).getTime() : NaN;
      if (isNaN(due)) { normal.push(l); return; }
      if (due < nowMs) overdue.push(l);
      else if (TH.iso(new Date(due)) === todayKey) dueToday.push(l);
      else normal.push(l);
    });

    var hero = '<div class="bw-hero">'
      + '<div class="bw-hero-inner">'
      +   '<div class="bw-hero-pill"><i class="bi bi-arrow-left-right"></i> ยืม-คืน Workstation</div>'
      +   '<div class="bw-hero-title">' + H.greetByTime() + '!</div>'
      +   '<div class="bw-hero-sub">สแกน QR · จัดการยืม-คืน · เห็นสถานะแบบเรียลไทม์</div>'
      + '</div>'
      + '<div class="bw-kpi-strip">'
      +   bwKpi('bi-arrow-up-circle', 'วันนี้ยืม', todayBorrowed, '#10b981,#059669')
      +   bwKpi('bi-arrow-down-circle', 'วันนี้คืน', todayReturned, '#0ea5e9,#0284c7')
      +   bwKpi('bi-card-checklist', 'กำลังยืม', loans.active || items.length, '#6366f1,#8b5cf6')
      +   bwKpi('bi-exclamation-triangle-fill', 'เกินกำหนด', overdue.length, '#f43f5e,#e11d48', overdue.length > 0)
      + '</div>'
      + '</div>';

    // Tabs
    var tabs = '<div class="bw-tabs" role="tablist">'
      + '<button class="bw-tab' + (BW_STATE.mode === 'borrow' ? ' is-active' : '') + '" data-mode="borrow"><i class="bi bi-arrow-up-circle"></i> <span>ยืม</span></button>'
      + '<button class="bw-tab' + (BW_STATE.mode === 'return' ? ' is-active' : '') + '" data-mode="return"><i class="bi bi-arrow-down-circle"></i> <span>คืน</span></button>'
      + '<button class="bw-tab' + (BW_STATE.mode === 'search' ? ' is-active' : '') + '" data-mode="search"><i class="bi bi-search"></i> <span>ค้นด่วน</span></button>'
      + '</div>';

    // Mode content
    var content = '<div class="bw-content">'
      + '<div class="bw-pane' + (BW_STATE.mode === 'borrow' ? ' is-active' : '') + '" data-pane="borrow">' + bwBorrowPane() + '</div>'
      + '<div class="bw-pane' + (BW_STATE.mode === 'return' ? ' is-active' : '') + '" data-pane="return">' + bwReturnPane(overdue, dueToday) + '</div>'
      + '<div class="bw-pane' + (BW_STATE.mode === 'search' ? ' is-active' : '') + '" data-pane="search">' + bwSearchPane() + '</div>'
      + '</div>';

    // Side rail (Activity + Alerts)
    var sideRail = '<div class="bw-rail">'
      + (overdue.length > 0 ? '<div class="bw-alert"><div class="bw-alert-head"><i class="bi bi-exclamation-triangle-fill"></i> เกินกำหนด <span class="bw-alert-count">' + overdue.length + '</span></div>'
          + '<div class="bw-alert-list">' + overdue.slice(0, 5).map(bwPendingItem).join('') + '</div></div>' : '')
      + (dueToday.length > 0 ? '<div class="bw-alert is-warn"><div class="bw-alert-head"><i class="bi bi-clock-history"></i> ครบกำหนดวันนี้ <span class="bw-alert-count">' + dueToday.length + '</span></div>'
          + '<div class="bw-alert-list">' + dueToday.slice(0, 5).map(bwPendingItem).join('') + '</div></div>' : '')
      + '<div class="bw-card-feed">'
      +   '<div class="bw-feed-head"><i class="bi bi-activity"></i> กิจกรรมล่าสุด <span class="bw-pulse"></span></div>'
      +   '<div class="bw-feed-list" id="bw-feed">' + bwActivityFeedHtml(dash && dash.recent_loans) + '</div>'
      + '</div>'
      + '</div>';

    var layout = '<div class="bw-layout">'
      + '<div class="bw-main">' + tabs + content + '</div>'
      + sideRail
      + '</div>';

    H.pageWrap(hero + layout + bwStyles());

    // Wire tabs
    $$('.bw-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        BW_STATE.mode = t.getAttribute('data-mode');
        $$('.bw-tab').forEach(function (x) { x.classList.toggle('is-active', x === t); });
        $$('.bw-pane').forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-pane') === BW_STATE.mode); });
        wireBorrowMode();
      });
    });

    // Quick rebind on overdue/due-today items
    $$('.bw-alert [data-rid]').forEach(function (b) {
      b.addEventListener('click', function () { doBwReturn(b.getAttribute('data-rid')); });
    });

    wireBorrowMode();
  }

  function bwKpi(icon, label, val, grad, pulse) {
    return '<div class="bw-kpi' + (pulse ? ' is-pulse' : '') + '">'
      + '<div class="bw-kpi-icon" style="background:linear-gradient(135deg,' + grad + ')"><i class="bi ' + icon + '"></i></div>'
      + '<div class="bw-kpi-body">'
      +   '<div class="bw-kpi-label">' + esc(label) + '</div>'
      +   '<div class="bw-kpi-val">' + esc(String(val)) + '</div>'
      + '</div>'
      + '</div>';
  }

  function bwPendingItem(l) {
    var days = '';
    if (l.due_at) {
      var diff = Math.round((Date.now() - new Date(l.due_at).getTime()) / 86400000);
      if (diff > 0) days = '<span class="bw-pending-days">เกิน ' + diff + ' วัน</span>';
    }
    return '<div class="bw-pending">'
      + (l.book_cover ? '<img src="' + esc(l.book_cover) + '" referrerpolicy="no-referrer" loading="lazy">' : '<div class="bw-pending-icon"><i class="bi bi-book"></i></div>')
      + '<div class="bw-pending-body">'
      +   '<div class="bw-pending-title">' + esc(l.book_title || '-') + '</div>'
      +   '<div class="bw-pending-meta">' + esc(l.user_name || '') + (l.user_class ? ' · ' + esc(l.user_class) : '') + '</div>'
      +   '<div class="bw-pending-foot"><span class="font-mono">' + esc(l.code) + '</span>' + days + '</div>'
      + '</div>'
      + '<button class="bw-pending-btn" data-rid="' + esc(l.id) + '" aria-label="รับคืน"><i class="bi bi-check-lg"></i></button>'
      + '</div>';
  }

  function bwActivityFeedHtml(loans) {
    if (!loans || !loans.length) return '<div class="empty-state" style="padding:14px"><i class="bi bi-inbox"></i><p style="font-size:11px">ยังไม่มีกิจกรรม</p></div>';
    return loans.slice(0, 8).map(function (l) {
      var isReturn = l.status === 'returned';
      return '<a href="#/loans/view?id=' + esc(l.id) + '" class="bw-feed-item ' + (isReturn ? 'is-return' : 'is-borrow') + '">'
        + '<div class="bw-feed-icon"><i class="bi ' + (isReturn ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle') + '"></i></div>'
        + '<div class="bw-feed-body">'
        +   '<div class="bw-feed-title">' + esc(l.book_title || '-') + '</div>'
        +   '<div class="bw-feed-meta">' + esc(l.user_name || '') + ' · ' + esc(TH.smart(isReturn ? (l.returned_at || l.borrowed_at) : l.borrowed_at)) + '</div>'
        + '</div>'
        + '</a>';
    }).join('');
  }

  function bwBorrowPane() {
    return '<div class="bw-stage">'
      + '<div class="bw-stage-head">'
      +   '<div class="bw-stage-title"><i class="bi bi-arrow-up-circle" style="color:#10b981"></i> ยืมหนังสือ</div>'
      +   '<div class="bw-stage-sub">สแกน QR Code หรือกรอกรหัสหนังสือ → กด Enter</div>'
      + '</div>'
      + '<div class="bw-scan-row">'
      +   '<button class="bw-scan-btn" id="bw-scan-borrow" type="button"><i class="bi bi-qr-code-scan"></i><span>สแกน QR</span></button>'
      +   '<div class="bw-input-wrap">'
      +     '<i class="bi bi-upc-scan bw-input-icon"></i>'
      +     '<input class="bw-input" id="bw-borrow-code" placeholder="รหัสหนังสือ (BK...) หรือ ISBN" autocomplete="off" inputmode="text" enterkeyhint="search">'
      +     '<button class="bw-input-clear" id="bw-borrow-clear" type="button" hidden><i class="bi bi-x-circle-fill"></i></button>'
      +   '</div>'
      +   '<button class="bw-go-btn bw-go-emerald" id="bw-borrow-go" type="button"><i class="bi bi-search"></i></button>'
      + '</div>'
      + '<div id="bw-borrow-result" class="bw-result"></div>'
      + '<div class="bw-suggest-head">หนังสือยอดนิยม</div>'
      + '<div id="bw-suggest" class="bw-suggest">' + H.skBlock(60) + '</div>'
      + '</div>';
  }

  function bwReturnPane(overdueList, dueTodayList) {
    var combined = (overdueList || []).concat(dueTodayList || []);
    var heatBlock = '';
    if (combined.length) {
      heatBlock = '<div class="bw-quick-return"><div class="bw-quick-head"><i class="bi bi-lightning-fill"></i> รับคืนด่วน (เกินกำหนด/วันนี้)</div>'
        + '<div class="bw-quick-grid">' + combined.slice(0, 6).map(function (l) {
          return '<button class="bw-quick-card" data-rid="' + esc(l.id) + '" type="button">'
            + '<div class="bw-quick-cover" style="' + (l.book_cover ? 'background-image:url(' + esc(l.book_cover) + ')' : '') + '">' + (l.book_cover ? '' : '<i class="bi bi-book"></i>') + '</div>'
            + '<div class="bw-quick-title">' + esc((l.book_title || '').substring(0, 28)) + '</div>'
            + '<div class="bw-quick-meta">' + esc(l.user_name || '') + '</div>'
            + '<i class="bi bi-check-circle-fill bw-quick-icon"></i>'
            + '</button>';
        }).join('') + '</div></div>';
    }

    return '<div class="bw-stage">'
      + '<div class="bw-stage-head">'
      +   '<div class="bw-stage-title"><i class="bi bi-arrow-down-circle" style="color:#0ea5e9"></i> คืนหนังสือ</div>'
      +   '<div class="bw-stage-sub">สแกน QR หรือกรอกรหัสยืม (LN...) / รหัสหนังสือ (BK...)</div>'
      + '</div>'
      + '<div class="bw-scan-row">'
      +   '<button class="bw-scan-btn" id="bw-scan-return" type="button"><i class="bi bi-qr-code-scan"></i><span>สแกน QR</span></button>'
      +   '<div class="bw-input-wrap">'
      +     '<i class="bi bi-receipt bw-input-icon"></i>'
      +     '<input class="bw-input" id="bw-return-code" placeholder="LN... หรือ BK... หรือชื่อผู้ยืม" autocomplete="off" inputmode="text" enterkeyhint="search">'
      +     '<button class="bw-input-clear" id="bw-return-clear" type="button" hidden><i class="bi bi-x-circle-fill"></i></button>'
      +   '</div>'
      +   '<button class="bw-go-btn bw-go-sky" id="bw-return-go" type="button"><i class="bi bi-search"></i></button>'
      + '</div>'
      + '<div id="bw-return-result" class="bw-result"></div>'
      + heatBlock
      + '</div>';
  }

  function bwSearchPane() {
    return '<div class="bw-stage">'
      + '<div class="bw-stage-head">'
      +   '<div class="bw-stage-title"><i class="bi bi-search" style="color:#8b5cf6"></i> ค้นหาด่วน</div>'
      +   '<div class="bw-stage-sub">ค้นหาผู้ยืม → ดูประวัติยืมและทำการคืน</div>'
      + '</div>'
      + '<div class="bw-scan-row">'
      +   '<div class="bw-input-wrap" style="flex:1">'
      +     '<i class="bi bi-person-fill bw-input-icon"></i>'
      +     '<input class="bw-input" id="bw-search-q" placeholder="ค้นหา ชื่อ · username · เลขประจำตัว · ห้อง" autocomplete="off" enterkeyhint="search">'
      +     '<button class="bw-input-clear" id="bw-search-clear" type="button" hidden><i class="bi bi-x-circle-fill"></i></button>'
      +   '</div>'
      +   '<button class="bw-go-btn bw-go-violet" id="bw-search-go" type="button"><i class="bi bi-search"></i></button>'
      + '</div>'
      + '<div id="bw-search-result" class="bw-result"></div>'
      + '</div>';
  }

  function wireBorrowMode() {
    // Auto-focus
    setTimeout(function () {
      var input = BW_STATE.mode === 'borrow' ? $('#bw-borrow-code') : BW_STATE.mode === 'return' ? $('#bw-return-code') : $('#bw-search-q');
      if (input) try { input.focus(); } catch (e) {}
    }, 100);

    if (BW_STATE.mode === 'borrow') wireBorrowPane();
    else if (BW_STATE.mode === 'return') wireReturnPane();
    else wireSearchPane();

    // Quick return cards
    $$('.bw-quick-card[data-rid]').forEach(function (b) {
      b.addEventListener('click', function () { doBwReturn(b.getAttribute('data-rid')); });
    });
  }

  function wireBorrowPane() {
    var input = $('#bw-borrow-code'); if (!input) return;
    var clearBtn = $('#bw-borrow-clear');
    var go = $('#bw-borrow-go');
    var scan = $('#bw-scan-borrow');

    function findBook() {
      var code = input.value.trim();
      if (!code) return;
      code = code.replace(/^SLS:BK:/i, '');
      Spinner.show('กำลังค้นหาหนังสือ', { stages: ['ค้นหา', 'ตรวจสอบสิทธิ์', 'พร้อม'] });
      window.call('book.get_by_code', { code: code }).then(function (b) {
        Spinner.hide();
        playBeep('success');
        $('#bw-borrow-result').innerHTML = renderBorrowFound(b);
        var btn = $('#bw-borrow-find-borrow');
        if (btn) btn.addEventListener('click', function () { openBorrowModal(b); });
      }).catch(function (e) {
        Spinner.hide();
        playBeep('error');
        $('#bw-borrow-result').innerHTML = '<div class="bw-empty"><i class="bi bi-x-circle-fill"></i><div>' + esc(e.message) + '</div></div>';
      });
    }

    input.addEventListener('input', function () {
      clearBtn.hidden = !input.value;
    });
    if (clearBtn) clearBtn.addEventListener('click', function () { input.value = ''; clearBtn.hidden = true; input.focus(); });
    go.addEventListener('click', findBook);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); findBook(); } });
    if (scan) scan.addEventListener('click', function () { openQrScanner('borrow', findBook); });

    // Load suggestions (popular books available)
    var sug = $('#bw-suggest');
    if (sug) {
      window.call('book.list', { sort: 'popular', available_only: true, per_page: 6 }).then(function (data) {
        if (!$('#bw-suggest')) return;
        if (!data.items.length) { $('#bw-suggest').innerHTML = '<div class="empty-state" style="padding:14px"><i class="bi bi-book"></i><p style="font-size:11px">ไม่มีหนังสือพร้อมยืม</p></div>'; return; }
        $('#bw-suggest').innerHTML = data.items.map(function (b) {
          return '<button class="bw-sug-card" data-code="' + esc(b.code) + '" type="button">'
            + (b.cover_url ? '<img src="' + esc(b.cover_url) + '" referrerpolicy="no-referrer" loading="lazy">' : '<div class="bw-sug-cover"><i class="bi bi-book"></i></div>')
            + '<div class="bw-sug-title">' + esc((b.title || '').substring(0, 30)) + '</div>'
            + '<div class="bw-sug-meta"><span class="font-mono">' + esc(b.code) + '</span><span><i class="bi bi-trophy" style="color:#f59e0b"></i> ' + (b.borrow_count || 0) + '</span></div>'
            + '</button>';
        }).join('');
        $$('.bw-sug-card').forEach(function (c) {
          c.addEventListener('click', function () {
            input.value = c.getAttribute('data-code');
            clearBtn.hidden = false;
            findBook();
          });
        });
      });
    }
  }

  function wireReturnPane() {
    var input = $('#bw-return-code'); if (!input) return;
    var clearBtn = $('#bw-return-clear');
    var go = $('#bw-return-go');
    var scan = $('#bw-scan-return');

    function findLoan() {
      var raw = input.value.trim();
      if (!raw) return;
      raw = raw.replace(/^SLS:BK:/i, '');
      Spinner.show('กำลังค้นหาการยืม', { stages: ['ค้นหา', 'ตรวจสอบ', 'พร้อม'] });
      window.call('loan.list', { status: 'borrowed', q: raw, per_page: 5 }).then(function (data) {
        Spinner.hide();
        if (!data.items.length) {
          playBeep('error');
          $('#bw-return-result').innerHTML = '<div class="bw-empty"><i class="bi bi-x-circle-fill"></i><div>ไม่พบรายการยืมที่ยังไม่คืน</div></div>';
          return;
        }
        playBeep('success');
        $('#bw-return-result').innerHTML = data.items.map(function (l) {
          var due = l.due_at ? new Date(l.due_at).getTime() : NaN;
          var isOverdue = !isNaN(due) && due < Date.now();
          return '<div class="bw-loan-card ' + (isOverdue ? 'is-overdue' : '') + '">'
            + (l.book_cover ? '<img class="bw-loan-cover" src="' + esc(l.book_cover) + '" referrerpolicy="no-referrer">' : '<div class="bw-loan-cover bw-loan-cover-fallback"><i class="bi bi-book"></i></div>')
            + '<div class="bw-loan-body">'
            +   '<div class="bw-loan-title">' + esc(l.book_title) + '</div>'
            +   '<div class="bw-loan-meta"><i class="bi bi-person"></i> ' + esc(l.user_name) + (l.user_class ? ' · ' + esc(l.user_class) : '') + '</div>'
            +   '<div class="bw-loan-meta"><i class="bi bi-receipt"></i> <b>' + esc(l.code) + '</b></div>'
            +   '<div class="bw-loan-meta"><i class="bi bi-calendar"></i> ยืม ' + esc(TH.date(l.borrowed_at)) + ' · ครบ ' + esc(TH.date(l.due_at)) + '</div>'
            +   (isOverdue ? '<div class="bw-loan-badge"><i class="bi bi-exclamation-triangle-fill"></i> เกินกำหนด</div>' : '')
            + '</div>'
            + '<button class="bw-return-btn" data-rid="' + esc(l.id) + '" type="button"><i class="bi bi-check-circle-fill"></i> รับคืน</button>'
            + '</div>';
        }).join('');
        $$('#bw-return-result [data-rid]').forEach(function (b) {
          b.addEventListener('click', function () { doBwReturn(b.getAttribute('data-rid')); });
        });
      }).catch(function (e) {
        Spinner.hide();
        playBeep('error');
        toast(e.message, 'error');
      });
    }
    input.addEventListener('input', function () { clearBtn.hidden = !input.value; });
    if (clearBtn) clearBtn.addEventListener('click', function () { input.value = ''; clearBtn.hidden = true; input.focus(); });
    go.addEventListener('click', findLoan);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); findLoan(); } });
    if (scan) scan.addEventListener('click', function () { openQrScanner('return', findLoan); });
  }

  function wireSearchPane() {
    var input = $('#bw-search-q'); if (!input) return;
    var clearBtn = $('#bw-search-clear');
    var go = $('#bw-search-go');

    function findUser() {
      var q = input.value.trim();
      if (!q) return;
      Spinner.show('กำลังค้นหา');
      window.call('user.list', { q: q, active_only: true }).then(function (data) {
        Spinner.hide();
        if (!data.items.length) {
          $('#bw-search-result').innerHTML = '<div class="bw-empty"><i class="bi bi-x-circle-fill"></i><div>ไม่พบผู้ใช้</div></div>';
          return;
        }
        $('#bw-search-result').innerHTML = '<div class="bw-user-grid">' + data.items.slice(0, 12).map(function (u) {
          return '<button class="bw-user-card" data-uid="' + esc(u.id) + '" type="button">'
            + '<div class="bw-user-av" style="' + H.avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(H.initials(u.full_name))) + '</div>'
            + '<div class="bw-user-info">'
            +   '<div class="bw-user-name">' + esc(u.full_name) + '</div>'
            +   '<div class="bw-user-meta">' + esc(u.username) + (u.class_name ? ' · ' + esc(u.class_name) : '') + '</div>'
            +   '<div class="bw-user-role"><span class="role-chip role-chip-' + esc(u.role) + '"><i class="bi bi-shield-check-fill"></i>' + esc(H.roleLabel(u.role)) + '</span></div>'
            + '</div>'
            + '<i class="bi bi-arrow-right bw-user-go"></i>'
            + '</button>';
        }).join('') + '</div>';
        $$('.bw-user-card[data-uid]').forEach(function (c) {
          c.addEventListener('click', function () { openUserLoansPanel(c.getAttribute('data-uid')); });
        });
      }).catch(function (e) { Spinner.hide(); toast(e.message, 'error'); });
    }
    input.addEventListener('input', function () { clearBtn.hidden = !input.value; });
    if (clearBtn) clearBtn.addEventListener('click', function () { input.value = ''; clearBtn.hidden = true; input.focus(); $('#bw-search-result').innerHTML = ''; });
    go.addEventListener('click', findUser);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); findUser(); } });
  }

  function openUserLoansPanel(userId) {
    Spinner.show('กำลังโหลดประวัติ');
    Promise.all([
      window.call('user.get', { id: userId }),
      window.call('loan.list', { user_id: userId, per_page: 30 })
    ]).then(function (results) {
      Spinner.hide();
      var u = results[0]; var loans = results[1].items || [];
      var active = loans.filter(function (l) { return l.status === 'borrowed' || l.status === 'overdue'; });
      var returned = loans.filter(function (l) { return l.status === 'returned'; });
      var html = '<div class="bw-user-detail">'
        + '<div class="bw-user-detail-head">'
        +   '<div class="bw-user-av-lg" style="' + H.avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(H.initials(u.full_name))) + '</div>'
        +   '<div style="flex:1;min-width:0">'
        +     '<div class="bw-user-detail-name">' + esc(u.full_name) + '</div>'
        +     '<div class="bw-user-detail-meta">' + esc(u.username) + (u.class_name ? ' · ' + esc(u.class_name) : '') + '</div>'
        +     '<div class="mt-2"><span class="role-chip role-chip-' + esc(u.role) + '"><i class="bi bi-shield-check-fill"></i>' + esc(H.roleLabel(u.role)) + '</span></div>'
        +   '</div>'
        + '</div>'
        + '<div class="bw-user-stats">'
        +   '<div class="bw-user-stat"><div class="bw-user-stat-val">' + active.length + '</div><div class="bw-user-stat-lbl">กำลังยืม</div></div>'
        +   '<div class="bw-user-stat"><div class="bw-user-stat-val" style="color:#10b981">' + returned.length + '</div><div class="bw-user-stat-lbl">คืนแล้ว</div></div>'
        +   '<div class="bw-user-stat"><div class="bw-user-stat-val" style="color:#dc2626">' + loans.filter(function(l){return cfgNum(l.fine_amount)>0&&l.fine_paid!=='yes';}).length + '</div><div class="bw-user-stat-lbl">ค่าปรับค้าง</div></div>'
        + '</div>';

      if (active.length) {
        html += '<div class="bw-user-section"><div class="bw-user-section-title"><i class="bi bi-arrow-up-circle"></i> กำลังยืมอยู่</div>'
          + active.map(function (l) {
            var due = l.due_at ? new Date(l.due_at).getTime() : NaN;
            var isOverdue = !isNaN(due) && due < Date.now();
            return '<div class="bw-loan-card ' + (isOverdue ? 'is-overdue' : '') + '">'
              + (l.book_cover ? '<img class="bw-loan-cover" src="' + esc(l.book_cover) + '" referrerpolicy="no-referrer">' : '<div class="bw-loan-cover bw-loan-cover-fallback"><i class="bi bi-book"></i></div>')
              + '<div class="bw-loan-body">'
              +   '<div class="bw-loan-title">' + esc(l.book_title) + '</div>'
              +   '<div class="bw-loan-meta"><i class="bi bi-receipt"></i> <b>' + esc(l.code) + '</b></div>'
              +   '<div class="bw-loan-meta"><i class="bi bi-calendar"></i> ครบ ' + esc(TH.date(l.due_at)) + '</div>'
              +   (isOverdue ? '<div class="bw-loan-badge"><i class="bi bi-exclamation-triangle-fill"></i> เกินกำหนด</div>' : '')
              + '</div>'
              + '<button class="bw-return-btn" data-rid="' + esc(l.id) + '" type="button"><i class="bi bi-check-circle-fill"></i> รับคืน</button>'
              + '</div>';
          }).join('')
          + '</div>';
      } else {
        html += '<div class="bw-empty"><i class="bi bi-emoji-smile-fill" style="color:#10b981"></i><div>ผู้ใช้คนนี้ไม่มีหนังสือค้างคืน</div></div>';
      }

      html += '</div>';
      $('#bw-search-result').innerHTML = html;
      $$('#bw-search-result [data-rid]').forEach(function (b) {
        b.addEventListener('click', function () { doBwReturn(b.getAttribute('data-rid')); });
      });
    }).catch(function (e) { Spinner.hide(); toast(e.message, 'error'); });
  }

  function renderBorrowFound(b) {
    var available = (b.qty_available || 0) > 0;
    return '<div class="bw-book-found">'
      + (b.cover_url ? '<img class="bw-book-cover" src="' + esc(b.cover_url) + '" referrerpolicy="no-referrer">' : '<div class="bw-book-cover bw-loan-cover-fallback"><i class="bi bi-book"></i></div>')
      + '<div class="bw-book-body">'
      +   '<div class="bw-book-title">' + esc(b.title) + '</div>'
      +   '<div class="bw-book-author">' + esc(b.author || '') + '</div>'
      +   '<div class="bw-book-badges">'
      +     '<span class="badge b-borrowed font-mono">' + esc(b.code) + '</span>'
      +     '<span class="badge ' + (available ? 'b-active' : 'b-overdue') + '">' + (available ? '<i class="bi bi-check-circle-fill"></i> ว่าง ' + b.qty_available + ' เล่ม' : '<i class="bi bi-x-circle-fill"></i> ไม่ว่าง') + '</span>'
      +     (b.location ? '<span class="badge" style="background:#f1f5f9;color:#475569"><i class="bi bi-geo-alt-fill"></i> ' + esc(b.location) + '</span>' : '')
      +   '</div>'
      + '</div>'
      + (available
        ? '<button class="bw-borrow-cta" id="bw-borrow-find-borrow" type="button"><i class="bi bi-arrow-up-circle-fill"></i> <span>ดำเนินการยืม</span><i class="bi bi-arrow-right" style="margin-left:auto"></i></button>'
        : '<div class="bw-no-stock"><i class="bi bi-clock-history"></i> ไม่มีเล่มว่าง — ผู้ยืมสามารถจองได้</div>')
      + '</div>';
  }

  function doBwReturn(id) {
    Spinner.show('กำลังบันทึกการคืน', { stages: ['ตรวจสอบ', 'คำนวณค่าปรับ', 'บันทึก', 'อัปเดตสต๊อก', 'เสร็จสิ้น'] });
    window.call('loan.return', { id: id }).then(function (r) {
      Spinner.hide();
      playBeep('success');
      var html = '<div style="font-size:14px;margin-top:6px"><b>' + esc(r.book ? r.book.title : '') + '</b></div>';
      if (r.fine_record && r.fine_record.amount > 0) {
        html += '<div style="font-size:24px;font-weight:800;color:#dc2626;margin-top:8px">฿' + r.fine_record.amount + '</div>'
          + '<div style="font-size:12px;color:#94a3b8">ค่าปรับเกินกำหนด</div>';
      }
      Swal.fire({
        icon: 'success', title: 'คืนสำเร็จ!',
        html: html, timer: 2400, showConfirmButton: false, timerProgressBar: true,
        showClass: { popup: 'animate__animated animate__zoomIn animate__faster' }
      });
      BW_STATE.dirty = true;
      // Reload workstation after delay for fresh KPIs
      setTimeout(function () {
        if (location.hash.indexOf('#/borrow') === 0) renderBorrowWorkstation();
      }, 1800);
    }).catch(function (e) {
      Spinner.hide();
      playBeep('error');
      alertError('คืนไม่สำเร็จ', e.message);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  QR CAMERA SCANNER (lazy load html5-qrcode)
  // ═══════════════════════════════════════════════════════════
  function openQrScanner(context, onSuccess) {
    var elemId = 'bw-qr-reader-' + Date.now();
    Modal.open({
      title: '📷 สแกน QR Code (' + (context === 'borrow' ? 'ยืม' : 'คืน') + ')',
      titleIcon: 'bi-qr-code-scan',
      html: '<div class="bw-qr-modal">'
        + '<div class="bw-qr-frame">'
        +   '<div id="' + elemId + '" class="bw-qr-reader"></div>'
        +   '<div class="bw-qr-overlay"><div class="bw-qr-target"><span></span><span></span><span></span><span></span><div class="bw-qr-scanline"></div></div></div>'
        + '</div>'
        + '<div class="bw-qr-help"><i class="bi bi-info-circle-fill"></i> หันกล้องไปยัง QR Code บนหน้าปกหนังสือ · ระบบจะอ่านอัตโนมัติ</div>'
        + '<div class="bw-qr-manual"><label class="text-xs muted">หรือกรอกรหัสด้วยมือ:</label>'
        +   '<div class="flex gap-2 mt-2"><input class="input" id="bw-qr-manual-code" placeholder="BK..." autocomplete="off"><button class="btn btn-primary" id="bw-qr-manual-go" type="button"><i class="bi bi-check"></i> ใช้</button></div>'
        + '</div>'
        + '</div>',
      footer: '<button class="btn" data-modal-close type="button"><i class="bi bi-x"></i> ปิด</button>',
      onOpen: function (host) {
        var manual = $('#bw-qr-manual-go', host);
        if (manual) manual.addEventListener('click', function () {
          var code = $('#bw-qr-manual-code', host).value.trim();
          if (!code) return;
          var targetInput = context === 'borrow' ? $('#bw-borrow-code') : $('#bw-return-code');
          if (targetInput) targetInput.value = code;
          Modal.close();
          if (onSuccess) onSuccess();
        });

        loadQRScanner().then(function (Html5Qrcode) {
          if (!$('#' + elemId)) return;
          var qr = new Html5Qrcode(elemId);
          BW_STATE.scanner = qr;
          qr.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
            function (text) {
              var code = String(text).replace(/^SLS:BK:/i, '');
              playBeep('success');
              try { qr.stop().then(function () { qr.clear(); }).catch(function(){}); } catch (e) {}
              BW_STATE.scanner = null;
              var targetInput = context === 'borrow' ? $('#bw-borrow-code') : $('#bw-return-code');
              if (targetInput) targetInput.value = code;
              Modal.close();
              if (onSuccess) onSuccess();
            },
            function () { /* decode error — ignore */ }
          ).catch(function (e) {
            var elem = $('#' + elemId);
            if (elem) elem.innerHTML = '<div class="bw-qr-error"><i class="bi bi-camera-video-off-fill"></i><div>ไม่สามารถเปิดกล้องได้</div><div class="text-xs muted mt-2">' + esc(e.message || '') + '</div><div class="text-xs muted">โปรดอนุญาตสิทธิ์ใช้กล้องของเว็บนี้</div></div>';
          });
        }).catch(function () {
          var elem = $('#' + elemId);
          if (elem) elem.innerHTML = '<div class="bw-qr-error"><i class="bi bi-wifi-off"></i><div>โหลด QR Scanner library ไม่สำเร็จ</div><div class="text-xs muted mt-2">โปรดใช้ช่องกรอกด้วยมือด้านล่าง</div></div>';
        });
      }
    });

    // Cleanup on modal close (override default)
    var host = $('#modal-host');
    var origCleanup = host._cleanup;
    host._cleanup = function () {
      if (BW_STATE.scanner) {
        try { BW_STATE.scanner.stop().then(function () { BW_STATE.scanner.clear(); }).catch(function(){}); } catch (e) {}
        BW_STATE.scanner = null;
      }
      if (origCleanup) origCleanup();
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  BORROW-RETURN STYLES (inline scoped)
  // ═══════════════════════════════════════════════════════════
  function bwStyles() {
    return '<style>'
      // Hero
      + '.bw-hero{position:relative;border-radius:24px;padding:0;color:#fff;background:linear-gradient(135deg,#f59e0b 0%,#d97706 45%,#ea580c 100%);overflow:hidden;box-shadow:0 18px 50px rgba(245,158,11,.35);margin-bottom:18px}'
      + '.bw-hero::before{content:"";position:absolute;top:-30%;right:-15%;width:60%;height:160%;background:radial-gradient(circle,rgba(255,255,255,.22),transparent 60%);transform:rotate(18deg);pointer-events:none}'
      + '.bw-hero-inner{position:relative;z-index:1;padding:22px 24px 16px}'
      + '.bw-hero-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);border-radius:99px;font-size:11px;font-weight:600;backdrop-filter:blur(6px);margin-bottom:8px}'
      + '.bw-hero-title{font-size:26px;font-weight:800;line-height:1.2;margin-bottom:4px;text-shadow:0 2px 10px rgba(0,0,0,.2)}'
      + '.bw-hero-sub{font-size:13px;opacity:.92}'
      + '.bw-kpi-strip{position:relative;z-index:1;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:10px;padding:14px 16px 18px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.08))}'
      + '.bw-kpi{display:flex;align-items:center;gap:10px;padding:12px;background:rgba(255,255,255,.95);border-radius:14px;box-shadow:0 6px 18px rgba(0,0,0,.12);position:relative;overflow:hidden;color:#1e293b}'
      + '.bw-kpi.is-pulse{animation:bwPulse 1.6s ease-in-out infinite}'
      + '@keyframes bwPulse{0%,100%{box-shadow:0 6px 18px rgba(244,63,94,.25)}50%{box-shadow:0 6px 24px rgba(244,63,94,.55)}}'
      + '.bw-kpi-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,.18)}'
      + '.bw-kpi-body{flex:1;min-width:0}'
      + '.bw-kpi-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}'
      + '.bw-kpi-val{font-size:24px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:#0f172a}'

      // Layout
      + '.bw-layout{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}'
      + '@media(max-width:1100px){.bw-layout{grid-template-columns:1fr}}'
      + '.bw-main{min-width:0}'
      + '.bw-rail{display:flex;flex-direction:column;gap:12px;min-width:0}'

      // Tabs
      + '.bw-tabs{display:flex;gap:4px;background:#f1f5f9;padding:4px;border-radius:14px;margin-bottom:14px}'
      + '.bw-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border:0;background:transparent;font-family:inherit;font-weight:700;font-size:13px;color:#64748b;border-radius:10px;cursor:pointer;transition:all .15s;min-height:44px}'
      + '.bw-tab i{font-size:16px}'
      + '.bw-tab:hover{color:#1e293b}'
      + '.bw-tab.is-active{background:#fff;color:#f59e0b;box-shadow:0 4px 12px rgba(245,158,11,.2)}'

      // Stage
      + '.bw-content{position:relative}'
      + '.bw-pane{display:none}.bw-pane.is-active{display:block;animation:bwFade .25s ease}'
      + '@keyframes bwFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}'
      + '.bw-stage{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:var(--shadow-sm)}'
      + '.bw-stage-head{margin-bottom:14px}'
      + '.bw-stage-title{font-size:16px;font-weight:800;color:#1e293b;display:flex;align-items:center;gap:8px;margin-bottom:2px}'
      + '.bw-stage-sub{font-size:12px;color:#64748b}'

      // Scan row (big input + scan button)
      + '.bw-scan-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:stretch;margin-bottom:14px}'
      + '.bw-scan-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0 14px;min-width:64px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:0;border-radius:14px;font-family:inherit;font-weight:700;font-size:11px;cursor:pointer;box-shadow:0 6px 16px rgba(99,102,241,.4);transition:transform .12s}'
      + '.bw-scan-btn i{font-size:22px}'
      + '.bw-scan-btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(99,102,241,.5)}'
      + '.bw-scan-btn:active{transform:scale(.95)}'
      + '.bw-input-wrap{position:relative;display:flex;align-items:center;min-width:0}'
      + '.bw-input-icon{position:absolute;left:14px;color:#94a3b8;font-size:18px;pointer-events:none}'
      + '.bw-input{width:100%;height:56px;padding:0 44px 0 44px;border:2px solid var(--line);background:#fff;border-radius:14px;font-size:16px;font-weight:600;font-family:monospace,inherit;color:#1e293b;outline:none;transition:all .15s;min-width:0;box-sizing:border-box}'
      + '.bw-input:focus{border-color:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.15);background:#fffbeb}'
      + '.bw-input-clear{position:absolute;right:10px;background:transparent;border:0;color:#94a3b8;cursor:pointer;font-size:18px;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center}'
      + '.bw-input-clear:hover{color:#475569;background:#f1f5f9}'
      + '.bw-go-btn{min-width:64px;height:56px;border:0;border-radius:14px;color:#fff;font-size:22px;cursor:pointer;transition:transform .12s;box-shadow:0 6px 16px rgba(0,0,0,.18)}'
      + '.bw-go-btn:hover{transform:translateY(-1px)}'
      + '.bw-go-btn:active{transform:scale(.95)}'
      + '.bw-go-emerald{background:linear-gradient(135deg,#10b981,#059669)}'
      + '.bw-go-sky{background:linear-gradient(135deg,#0ea5e9,#0284c7)}'
      + '.bw-go-violet{background:linear-gradient(135deg,#8b5cf6,#7c3aed)}'
      + '.bw-result{margin-top:8px}'

      // Book found card (borrow result)
      + '.bw-book-found{display:grid;grid-template-columns:auto 1fr;gap:14px;padding:14px;background:linear-gradient(135deg,#f0fdf4,#fff);border:1px solid #86efac;border-radius:16px;margin-top:14px;animation:bwSlideIn .3s cubic-bezier(.2,.8,.2,1)}'
      + '@keyframes bwSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}'
      + '.bw-book-cover{width:80px;height:112px;border-radius:10px;object-fit:cover;background-size:cover;background-position:center}'
      + '.bw-loan-cover-fallback{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px}'
      + '.bw-book-body{min-width:0}'
      + '.bw-book-title{font-size:16px;font-weight:800;color:#1e293b;line-height:1.3;margin-bottom:2px}'
      + '.bw-book-author{font-size:12px;color:#64748b;margin-bottom:8px}'
      + '.bw-book-badges{display:flex;flex-wrap:wrap;gap:6px}'
      + '.bw-borrow-cta{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:14px 18px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:0;border-radius:14px;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 10px 26px rgba(16,185,129,.42);transition:transform .12s;min-height:56px}'
      + '.bw-borrow-cta:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(16,185,129,.52)}'
      + '.bw-borrow-cta:active{transform:scale(.98)}'
      + '.bw-borrow-cta i{font-size:22px}'
      + '.bw-no-stock{grid-column:1/-1;padding:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;color:#9a3412;font-size:13px;display:flex;align-items:center;gap:8px;justify-content:center}'

      // Empty state
      + '.bw-empty{padding:24px;background:linear-gradient(135deg,#fef2f2,#fff);border:1px dashed #fecaca;border-radius:14px;text-align:center;color:#7f1d1d;margin-top:14px}'
      + '.bw-empty i{font-size:40px;color:#f43f5e;margin-bottom:8px}'
      + '.bw-empty div{font-size:13px;font-weight:600}'

      // Loan card (return result)
      + '.bw-loan-card{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px;background:#fff;border:1px solid var(--line);border-left:4px solid #0ea5e9;border-radius:14px;margin-bottom:10px;animation:bwSlideIn .25s ease-out}'
      + '.bw-loan-card.is-overdue{border-left-color:#f43f5e;background:linear-gradient(90deg,#fef2f2,#fff)}'
      + '.bw-loan-cover{width:50px;height:70px;border-radius:8px;object-fit:cover;flex-shrink:0}'
      + '.bw-loan-body{min-width:0}'
      + '.bw-loan-title{font-size:14px;font-weight:700;color:#1e293b;line-height:1.3;overflow-wrap:anywhere}'
      + '.bw-loan-meta{font-size:11px;color:#64748b;margin-top:2px;display:flex;align-items:center;gap:4px}'
      + '.bw-loan-meta i{font-size:12px}'
      + '.bw-loan-badge{display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:3px 8px;border-radius:99px;background:#fef2f2;color:#dc2626;font-size:10px;font-weight:700}'
      + '.bw-return-btn{display:flex;align-items:center;gap:6px;padding:10px 14px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:0;border-radius:12px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 6px 16px rgba(16,185,129,.32);transition:transform .12s;white-space:nowrap;min-height:44px}'
      + '.bw-return-btn:hover{transform:translateY(-1px)}'
      + '.bw-return-btn:active{transform:scale(.95)}'

      // Quick return grid
      + '.bw-quick-return{margin-top:18px;padding:14px;background:linear-gradient(135deg,#fff7ed,#fff);border:1px solid #fdba74;border-radius:14px}'
      + '.bw-quick-head{font-size:13px;font-weight:800;color:#9a3412;margin-bottom:10px;display:flex;align-items:center;gap:6px}'
      + '.bw-quick-head i{color:#f59e0b}'
      + '.bw-quick-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(140px,100%),1fr));gap:8px}'
      + '.bw-quick-card{position:relative;padding:8px;background:#fff;border:1px solid #fed7aa;border-radius:10px;cursor:pointer;text-align:center;font-family:inherit;transition:transform .12s;color:inherit}'
      + '.bw-quick-card:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(245,158,11,.25);border-color:#f59e0b}'
      + '.bw-quick-card:active{transform:scale(.96)}'
      + '.bw-quick-cover{width:56px;height:80px;border-radius:8px;margin:0 auto 4px;background-color:#e2e8f0;background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:20px}'
      + '.bw-quick-title{font-size:11px;font-weight:700;color:#1e293b;line-height:1.2}'
      + '.bw-quick-meta{font-size:10px;color:#64748b;margin-top:2px}'
      + '.bw-quick-icon{position:absolute;top:6px;right:6px;color:#10b981;font-size:16px;opacity:0;transition:opacity .15s}'
      + '.bw-quick-card:hover .bw-quick-icon{opacity:1}'

      // Suggestions
      + '.bw-suggest-head{margin-top:18px;margin-bottom:8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em}'
      + '.bw-suggest{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(130px,100%),1fr));gap:8px}'
      + '.bw-sug-card{padding:8px;background:#fff;border:1px solid var(--line);border-radius:10px;cursor:pointer;text-align:center;font-family:inherit;transition:transform .12s;color:inherit}'
      + '.bw-sug-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-sm);border-color:#a5b4fc}'
      + '.bw-sug-card img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;display:block}'
      + '.bw-sug-cover{width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;border-radius:6px}'
      + '.bw-sug-title{font-size:11px;font-weight:700;color:#1e293b;margin-top:4px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}'
      + '.bw-sug-meta{font-size:9px;color:#94a3b8;margin-top:2px;display:flex;justify-content:space-between;align-items:center;gap:4px}'

      // User search grid
      + '.bw-user-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:8px}'
      + '.bw-user-card{display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border:1px solid var(--line);border-radius:12px;cursor:pointer;font-family:inherit;text-align:left;transition:transform .12s;color:inherit;width:100%}'
      + '.bw-user-card:hover{transform:translateX(2px);box-shadow:var(--shadow-sm);border-color:#a5b4fc}'
      + '.bw-user-av{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;background-size:cover;background-position:center}'
      + '.bw-user-info{flex:1;min-width:0}'
      + '.bw-user-name{font-size:13px;font-weight:700;color:#1e293b}'
      + '.bw-user-meta{font-size:11px;color:#64748b}'
      + '.bw-user-role{margin-top:4px}'
      + '.bw-user-go{color:#94a3b8;font-size:18px;flex-shrink:0}'

      // User detail
      + '.bw-user-detail{margin-top:14px}'
      + '.bw-user-detail-head{display:flex;gap:14px;align-items:center;padding:14px;background:linear-gradient(135deg,#eef2ff,#fff);border:1px solid #c7d2fe;border-radius:14px;margin-bottom:12px}'
      + '.bw-user-av-lg{width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;flex-shrink:0;background-size:cover;background-position:center;box-shadow:0 8px 20px rgba(99,102,241,.32)}'
      + '.bw-user-detail-name{font-size:18px;font-weight:800;color:#1e293b}'
      + '.bw-user-detail-meta{font-size:12px;color:#64748b}'
      + '.bw-user-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}'
      + '.bw-user-stat{padding:10px;background:#fff;border:1px solid var(--line);border-radius:12px;text-align:center}'
      + '.bw-user-stat-val{font-size:22px;font-weight:800;color:#1e293b;line-height:1;font-variant-numeric:tabular-nums}'
      + '.bw-user-stat-lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:4px}'
      + '.bw-user-section-title{font-size:13px;font-weight:800;color:#1e293b;margin:10px 0;display:flex;align-items:center;gap:6px}'

      // Side rail
      + '.bw-alert{background:#fff;border:1px solid var(--line);border-left:4px solid #f43f5e;border-radius:14px;padding:12px;box-shadow:var(--shadow-sm)}'
      + '.bw-alert.is-warn{border-left-color:#f59e0b}'
      + '.bw-alert-head{font-size:12px;font-weight:800;color:#1e293b;margin-bottom:8px;display:flex;align-items:center;gap:6px}'
      + '.bw-alert-head i{color:#f43f5e;font-size:14px;animation:bwPulseFast 1.4s ease-in-out infinite}'
      + '.bw-alert.is-warn .bw-alert-head i{color:#f59e0b;animation:none}'
      + '@keyframes bwPulseFast{0%,100%{opacity:1}50%{opacity:.6}}'
      + '.bw-alert-count{margin-left:auto;padding:1px 8px;background:#f43f5e;color:#fff;border-radius:99px;font-size:11px}'
      + '.bw-alert.is-warn .bw-alert-count{background:#f59e0b}'
      + '.bw-pending{display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--line-soft);align-items:center}'
      + '.bw-pending:last-child{border-bottom:0}'
      + '.bw-pending img{width:36px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0}'
      + '.bw-pending-icon{width:36px;height:48px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
      + '.bw-pending-body{flex:1;min-width:0}'
      + '.bw-pending-title{font-size:12px;font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.bw-pending-meta{font-size:10px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.bw-pending-foot{font-size:10px;color:#94a3b8;margin-top:2px;display:flex;justify-content:space-between;gap:4px}'
      + '.bw-pending-days{color:#dc2626;font-weight:700}'
      + '.bw-pending-btn{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:0;cursor:pointer;font-size:16px;box-shadow:0 4px 10px rgba(16,185,129,.32);transition:transform .12s;flex-shrink:0}'
      + '.bw-pending-btn:hover{transform:scale(1.08)}'
      + '.bw-pending-btn:active{transform:scale(.92)}'

      // Activity feed
      + '.bw-card-feed{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;box-shadow:var(--shadow-sm)}'
      + '.bw-feed-head{font-size:12px;font-weight:800;color:#1e293b;margin-bottom:8px;display:flex;align-items:center;gap:6px}'
      + '.bw-feed-head i{color:#6366f1}'
      + '.bw-pulse{width:8px;height:8px;border-radius:50%;background:#10b981;margin-left:auto;box-shadow:0 0 8px #10b981;animation:bwPulseFast 1.4s ease-in-out infinite}'
      + '.bw-feed-list{display:flex;flex-direction:column;gap:8px;max-height:380px;overflow-y:auto}'
      + '.bw-feed-item{display:flex;gap:8px;padding:6px;border-radius:10px;text-decoration:none;color:inherit;transition:background .12s}'
      + '.bw-feed-item:hover{background:#f8fafc}'
      + '.bw-feed-icon{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;font-size:16px}'
      + '.bw-feed-item.is-borrow .bw-feed-icon{background:linear-gradient(135deg,#6366f1,#8b5cf6)}'
      + '.bw-feed-item.is-return .bw-feed-icon{background:linear-gradient(135deg,#10b981,#059669)}'
      + '.bw-feed-body{flex:1;min-width:0}'
      + '.bw-feed-title{font-size:12px;font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.bw-feed-meta{font-size:10px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'

      // QR scanner modal
      + '.bw-qr-modal{padding:0}'
      + '.bw-qr-frame{position:relative;width:100%;background:#0f172a;border-radius:14px;overflow:hidden;aspect-ratio:1;max-width:380px;margin:0 auto}'
      + '.bw-qr-reader{width:100%;height:100%}'
      + '.bw-qr-reader video{width:100%!important;height:100%!important;object-fit:cover}'
      + '.bw-qr-overlay{position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center}'
      + '.bw-qr-target{position:relative;width:60%;aspect-ratio:1}'
      + '.bw-qr-target > span{position:absolute;width:30px;height:30px;border:3px solid #10b981;box-shadow:0 0 12px rgba(16,185,129,.6)}'
      + '.bw-qr-target > span:nth-child(1){top:0;left:0;border-right:0;border-bottom:0;border-top-left-radius:10px}'
      + '.bw-qr-target > span:nth-child(2){top:0;right:0;border-left:0;border-bottom:0;border-top-right-radius:10px}'
      + '.bw-qr-target > span:nth-child(3){bottom:0;left:0;border-right:0;border-top:0;border-bottom-left-radius:10px}'
      + '.bw-qr-target > span:nth-child(4){bottom:0;right:0;border-left:0;border-top:0;border-bottom-right-radius:10px}'
      + '.bw-qr-scanline{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#10b981,transparent);box-shadow:0 0 12px #10b981;animation:bwScan 2s ease-in-out infinite}'
      + '@keyframes bwScan{0%,100%{top:0}50%{top:calc(100% - 2px)}}'
      + '.bw-qr-help{margin-top:14px;padding:10px;background:#eff6ff;border-radius:10px;color:#1e40af;font-size:12px;display:flex;gap:6px;align-items:center}'
      + '.bw-qr-help i{color:#3b82f6;flex-shrink:0}'
      + '.bw-qr-manual{margin-top:10px;padding:10px;background:#f8fafc;border-radius:10px}'
      + '.bw-qr-error{padding:40px 20px;text-align:center;color:#fca5a5}'
      + '.bw-qr-error i{font-size:48px;display:block;margin-bottom:10px}'

      // Mobile responsive
      + '@media(max-width:640px){'
      +   '.bw-hero-title{font-size:22px}'
      +   '.bw-hero-inner{padding:18px 18px 12px}'
      +   '.bw-kpi-strip{padding:10px 12px 14px;grid-template-columns:repeat(2,1fr)}'
      +   '.bw-kpi-val{font-size:20px}'
      +   '.bw-tab{font-size:12px;padding:9px 8px}'
      +   '.bw-tab span{display:inline}'
      +   '.bw-stage{padding:14px;border-radius:14px}'
      +   '.bw-scan-row{grid-template-columns:auto 1fr;grid-template-rows:auto auto}'
      +   '.bw-go-btn{grid-column:1/-1;width:100%}'
      +   '.bw-scan-btn{font-size:10px}'
      +   '.bw-scan-btn i{font-size:18px}'
      +   '.bw-input{height:52px;font-size:15px;padding:0 40px 0 40px}'
      +   '.bw-book-found{grid-template-columns:1fr;text-align:center}'
      +   '.bw-book-cover{margin:0 auto;width:100px;height:140px}'
      +   '.bw-book-badges{justify-content:center}'
      +   '.bw-loan-card{grid-template-columns:auto 1fr;grid-template-rows:auto auto}'
      +   '.bw-return-btn{grid-column:1/-1;justify-content:center}'
      + '}'

      + '</style>';
  }

  // ═══════════════════════════════════════════════════════════
  //  LOANS LIST (staff)
  // ═══════════════════════════════════════════════════════════
  var LOANS_STATE = { q: '', status: '', page: 1 };

  Routes['#/loans'] = function () {
    if (!H.hasCap('loan.manage|report.view_all')) { toast('คุณไม่มีสิทธิ์', 'warning'); location.hash = '#/dashboard'; return; }
    renderLoansList(false);
  };
  Routes['#/my/loans'] = function () { renderLoansList(true); };

  Routes['#/loans/view'] = function (hash) {
    var id = (hash.split('?id=')[1] || '').replace(/[^a-z0-9-]/gi, '');
    if (id) renderLoanDetail(id);
  };

  function renderLoansList(own) {
    var hero = H.heroHtml({
      icon: own ? 'bi-bookmark-heart-fill' : 'bi-card-checklist',
      pill: own ? 'การยืมของฉัน' : 'รายการยืม',
      title: own ? 'การยืมหนังสือของฉัน' : 'จัดการรายการยืม',
      sub: 'ดู ติดตาม และจัดการสถานะการยืม',
      grad: own ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)'
    });
    var statusOpts = [
      ['', 'ทุกสถานะ'],
      ['borrowed', 'กำลังยืม'],
      ['overdue', 'เกินกำหนด'],
      ['returned', 'คืนแล้ว'],
      ['lost', 'สูญหาย']
    ];
    var toolbar = '<div class="toolbar">'
      + '<div class="search-box"><i class="bi bi-search"></i><input class="input" placeholder="ค้นหา รหัส, ชื่อ, ผู้ใช้" id="ln-q" value="' + esc(LOANS_STATE.q) + '"></div>'
      + '<div class="filters">' + statusOpts.map(function (s) {
        return '<button class="chip ' + (LOANS_STATE.status === s[0] ? 'active' : '') + '" data-status="' + esc(s[0]) + '">' + esc(s[1]) + '</button>';
      }).join('') + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="ln-clear"><i class="bi bi-x-circle"></i> ล้าง</button>'
      + '</div>';
    H.pageWrap(hero + toolbar + '<div id="ln-list">' + H.skBlock(80) + H.skBlock(80) + '</div><div id="ln-pag" class="text-center mt-4"></div>');
    var debouncer = null;
    $('#ln-q').addEventListener('input', function () {
      clearTimeout(debouncer);
      debouncer = setTimeout(function () { LOANS_STATE.q = $('#ln-q').value.trim(); LOANS_STATE.page = 1; loadLoans(own); }, 300);
    });
    $$('.chip[data-status]').forEach(function (c) {
      c.addEventListener('click', function () {
        LOANS_STATE.status = c.getAttribute('data-status') || '';
        LOANS_STATE.page = 1;
        renderLoansList(own);
      });
    });
    $('#ln-clear').addEventListener('click', function () {
      LOANS_STATE = { q: '', status: '', page: 1 };
      renderLoansList(own);
    });
    loadLoans(own);
  }

  function loadLoans(own) {
    var list = $('#ln-list');
    if (!list) return;
    list.innerHTML = H.skBlock(80) + H.skBlock(80);
    var p = { q: LOANS_STATE.q, status: LOANS_STATE.status, page: LOANS_STATE.page, per_page: 24 };
    if (own) p.user_id = 'self';
    window.call('loan.list', p).then(function (data) {
      if (!$('#ln-list')) return;
      if (!data.items.length) {
        $('#ln-list').innerHTML = H.emptyState('ไม่พบรายการ', 'bi-card-checklist');
        $('#ln-pag').innerHTML = '';
        return;
      }
      var html = '<div class="flex-col gap-3">' + data.items.map(function (l) {
        var st = l.status;
        return '<div class="loan-card ' + (st === 'overdue' ? 'overdue' : st === 'returned' ? 'returned' : '') + '" data-go="#/loans/view?id=' + esc(l.id) + '">'
          + '<div class="lc-cover" style="background-image:url(' + esc(l.book_cover || '') + ')">' + (l.book_cover ? '' : '<i class="bi bi-book"></i>') + '</div>'
          + '<div class="lc-body">'
          +   '<div class="lc-title">' + esc(l.book_title) + ' <span class="text-xs muted font-mono">(' + esc(l.book_code) + ')</span></div>'
          +   '<div class="lc-meta">'
          +     '<span><i class="bi bi-person"></i> <b>' + esc(l.user_name) + '</b>' + (l.user_class ? ' · ' + esc(l.user_class) : '') + '</span>'
          +     '<span><i class="bi bi-receipt"></i> ' + esc(l.code) + '</span>'
          +     '<span><i class="bi bi-calendar"></i> ยืม ' + esc(TH.date(l.borrowed_at)) + '</span>'
          +     '<span><i class="bi bi-clock"></i> ครบ ' + esc(TH.date(l.due_at)) + '</span>'
          +     (l.returned_at ? '<span><i class="bi bi-check"></i> คืน ' + esc(TH.date(l.returned_at)) + '</span>' : '')
          +   '</div>'
          +   '<div class="mt-2">' + H.loanStatusBadge(st) + (l.fine_amount > 0 ? ' <span class="badge ' + (l.fine_paid === 'yes' ? 'b-paid' : 'b-unpaid') + '">ค่าปรับ ฿' + l.fine_amount + (l.fine_paid === 'yes' ? ' (ชำระแล้ว)' : '') + '</span>' : '') + '</div>'
          + '</div></div>';
      }).join('') + '</div>';
      $('#ln-list').innerHTML = html;
      wireRowGo();
      // Pagination
      var pag = '';
      if (data.pages > 1) {
        pag = '<div class="flex justify-center gap-2 items-center">';
        if (data.page > 1) pag += '<button class="btn btn-sm" data-pg="' + (data.page - 1) + '"><i class="bi bi-chevron-left"></i></button>';
        pag += '<span class="text-sm muted">หน้า ' + data.page + ' / ' + data.pages + ' (รวม ' + data.total + ')</span>';
        if (data.page < data.pages) pag += '<button class="btn btn-sm" data-pg="' + (data.page + 1) + '"><i class="bi bi-chevron-right"></i></button>';
        pag += '</div>';
      } else {
        pag = '<span class="text-sm muted">รวม ' + data.total + ' รายการ</span>';
      }
      $('#ln-pag').innerHTML = pag;
      $$('#ln-pag [data-pg]').forEach(function (b) {
        b.addEventListener('click', function () {
          LOANS_STATE.page = parseInt(b.getAttribute('data-pg'), 10);
          loadLoans(own);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function renderLoanDetail(id) {
    H.pageWrap(H.skBlock(280));
    window.call('loan.get', { id: id }).then(function (data) {
      if (!$('#page')) return;
      var l = data.loan, b = data.book, u = data.user, lib = data.librarian;
      var canManage = H.hasCap('loan.manage');
      var st = l.status;
      if (st === 'borrowed' && l.due_at && new Date(l.due_at).getTime() < Date.now()) st = 'overdue';

      var actions = '<a href="' + (window.history.length > 1 ? 'javascript:history.back()' : '#/loans') + '" class="btn btn-sm" style="background:rgba(255,255,255,.18);color:#fff;border-color:transparent;backdrop-filter:blur(6px)"><i class="bi bi-arrow-left"></i> กลับ</a>';
      var hero = '<div class="sd-hero" style="background:linear-gradient(135deg,' + (st === 'overdue' ? '#f43f5e,#e11d48' : st === 'returned' ? '#10b981,#059669' : '#6366f1,#8b5cf6') + ')">'
        + actions
        + '<div class="sd-hero-title" style="margin-top:14px">รายการยืม <span class="font-mono" style="opacity:.85">' + esc(l.code) + '</span></div>'
        + '<div class="sd-hero-sub">' + H.loanStatusBadge(st) + '</div>'
        + '</div>';

      var bookSec = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-book-half"></i> หนังสือ</div>'
        + (b ? '<div class="flex gap-3">'
            + (b.cover_url ? '<img src="' + esc(b.cover_url) + '" referrerpolicy="no-referrer" style="width:80px;height:112px;border-radius:8px;object-fit:cover">' : '<div style="width:80px;height:112px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:32px"><i class="bi bi-book"></i></div>')
            + '<div style="flex:1;min-width:0">'
            +   '<div class="font-bold">' + esc(b.title) + '</div>'
            +   '<div class="text-sm muted mt-2">รหัส: <b>' + esc(b.code) + '</b></div>'
            +   '<div class="text-sm muted">ที่จัดเก็บ: ' + esc(b.location || '-') + '</div>'
            +   '<a href="#/books/view?id=' + esc(b.id) + '" class="btn btn-sm mt-3"><i class="bi bi-eye"></i> ดูรายละเอียด</a>'
            + '</div></div>'
            : '<div class="muted">ไม่พบหนังสือ</div>')
        + '</div>';

      var userSec = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-person"></i> ผู้ยืม</div>'
        + (u ? '<div class="flex gap-3 items-center"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;' + H.avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(H.initials(u.full_name))) + '</div>'
            + '<div><div class="font-bold">' + esc(u.full_name) + '</div><div class="text-xs muted">' + esc(u.username) + (u.class_name ? ' · ' + esc(u.class_name) : '') + '</div>'
            + '<div class="mt-2"><span class="role-chip role-chip-' + esc(u.role) + '"><i class="bi bi-shield-check-fill"></i>' + esc(H.roleLabel(u.role)) + '</span></div></div></div>'
            : '<div class="muted">ไม่พบผู้ใช้</div>')
        + '</div>';

      var details = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-info-circle"></i> รายละเอียดการยืม</div>'
        + '<table style="width:100%;font-size:13px"><tbody>'
        + '<tr><td class="muted" style="padding:4px 0;width:140px">วันที่ยืม</td><td>' + esc(TH.dateTime(l.borrowed_at)) + '</td></tr>'
        + '<tr><td class="muted" style="padding:4px 0">ครบกำหนด</td><td>' + esc(TH.dateLong(l.due_at)) + '</td></tr>'
        + (l.returned_at ? '<tr><td class="muted" style="padding:4px 0">วันที่คืน</td><td>' + esc(TH.dateTime(l.returned_at)) + '</td></tr>' : '')
        + (lib ? '<tr><td class="muted" style="padding:4px 0">บรรณารักษ์</td><td>' + esc(lib.full_name) + '</td></tr>' : '')
        + (l.fine_amount > 0 ? '<tr><td class="muted" style="padding:4px 0">ค่าปรับ</td><td><b style="color:#dc2626">฿' + l.fine_amount + '</b> ' + (l.fine_paid === 'yes' ? '<span class="badge b-paid">ชำระแล้ว</span>' : '<span class="badge b-unpaid">ยังไม่ชำระ</span>') + '</td></tr>' : '')
        + (l.notes ? '<tr><td class="muted" style="padding:4px 0">หมายเหตุ</td><td style="white-space:pre-wrap">' + esc(l.notes) + '</td></tr>' : '')
        + '</tbody></table></div>';

      var actionBar = '';
      if (canManage && (st === 'borrowed' || st === 'overdue')) {
        actionBar = '<div class="flex gap-2 mt-4" style="flex-wrap:wrap">'
          + '<button class="btn btn-success btn-lg" id="ld-return"><i class="bi bi-check-circle"></i> รับคืน</button>'
          + '<button class="btn btn-warning" id="ld-renew"><i class="bi bi-arrow-clockwise"></i> ต่ออายุ</button>'
          + '<button class="btn btn-danger" id="ld-lost"><i class="bi bi-x-circle"></i> ทำหาย</button>'
          + '<button class="btn btn-ghost" id="ld-cancel"><i class="bi bi-trash"></i> ยกเลิกการยืม</button>'
          + '<button class="btn" id="ld-print"><i class="bi bi-printer"></i> พิมพ์ใบยืม</button>'
          + '</div>';
      }

      H.pageWrap(hero
        + '<div class="sd-grid-2">' + bookSec + userSec + '</div>'
        + details + actionBar);

      if ($('#ld-return')) $('#ld-return').addEventListener('click', function () {
        confirmModal({ title: 'รับคืนหนังสือ', message: 'ยืนยันรับคืน ' + b.title + '?', okText: 'รับคืน' }).then(function (ok) {
          if (ok) doBwReturn(l.id);
        });
      });
      if ($('#ld-renew')) $('#ld-renew').addEventListener('click', function () {
        promptModal({ title: 'ต่ออายุ', message: 'จำนวนวันที่ต่อ', value: Store.boot.settings.max_borrow_days || '7', inputType: 'number' }).then(function (days) {
          if (!days) return;
          Spinner.show('กำลังต่ออายุ');
          window.call('loan.renew', { id: l.id, days: parseInt(days, 10) }).then(function () {
            Spinner.hide();
            alertSuccess('ต่ออายุสำเร็จ');
            renderLoanDetail(l.id);
          }).catch(function (e) { Spinner.hide(); alertError('ไม่สำเร็จ', e.message); });
        });
      });
      if ($('#ld-lost')) $('#ld-lost').addEventListener('click', function () {
        promptModal({ title: 'แจ้งหนังสือสูญหาย', message: 'จำนวนเงินค่าหนังสือ (บาท)', value: '0', inputType: 'number', required: true }).then(function (fee) {
          if (fee === null) return;
          confirmModal({ title: 'ยืนยันแจ้งหาย', message: 'จะเปลี่ยนสถานะเป็น "สูญหาย" และสร้างค่าปรับ', danger: true, okText: 'แจ้งหาย' }).then(function (ok) {
            if (!ok) return;
            Spinner.show('กำลังบันทึก');
            window.call('loan.return', { id: l.id, lost: true, lost_fee: fee }).then(function () {
              Spinner.hide();
              alertSuccess('บันทึกแล้ว');
              renderLoanDetail(l.id);
            }).catch(function (e) { Spinner.hide(); alertError('ไม่สำเร็จ', e.message); });
          });
        });
      });
      if ($('#ld-cancel')) $('#ld-cancel').addEventListener('click', function () {
        confirmModal({ title: 'ยกเลิกการยืม', message: 'จะลบการยืมนี้ + คืนสต๊อกหนังสือ — ใช้สำหรับกรณีกรอกผิด', danger: true, okText: 'ยกเลิก' }).then(function (ok) {
          if (!ok) return;
          window.call('loan.cancel', { id: l.id }).then(function () {
            alertSuccess('ยกเลิกแล้ว');
            location.hash = '#/loans';
          }).catch(function (e) { alertError('ไม่สำเร็จ', e.message); });
        });
      });
      if ($('#ld-print')) $('#ld-print').addEventListener('click', function () { printLoanSlip(l, b, u); });
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function printLoanSlip(l, b, u) {
    var orgName = (Store.boot.settings && Store.boot.settings.library_name) || (Store.boot.app && Store.boot.app.name);
    var w = window.open('', '_blank', 'width=600,height=720');
    if (!w) { toast('โปรดอนุญาต popup', 'warning'); return; }
    var html = '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ใบยืม ' + esc(l.code) + '</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700;800&family=Sarabun:wght@400;500;600&display=swap" rel="stylesheet">'
      + '<style>'
      + '@page{size:A5 portrait;margin:14mm}'
      + 'body{font-family:Sarabun,Kanit,sans-serif;color:#1e293b;margin:0;padding:20px}'
      + '.head{text-align:center;border-bottom:2px solid #6366f1;padding-bottom:12px;margin-bottom:14px}'
      + '.head h1{font-family:Kanit;font-size:18px;margin:0 0 4px}'
      + '.head p{margin:2px 0;font-size:11px;color:#64748b}'
      + '.title{font-family:Kanit;font-size:20px;font-weight:800;text-align:center;margin:14px 0;color:#6366f1}'
      + 'table{width:100%;border-collapse:collapse;font-size:12px}'
      + 'td{padding:5px 4px;border-bottom:1px dashed #cbd5e1}'
      + 'td.lbl{color:#64748b;width:35%}'
      + 'td b{color:#1e293b}'
      + '.sign{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:11px}'
      + '.sign .box{text-align:center;border-top:1px dashed #94a3b8;padding-top:6px}'
      + '.footer{margin-top:18px;text-align:center;font-size:10px;color:#94a3b8}'
      + '</style></head><body>'
      + '<div class="head">'
      +   '<h1>' + esc(orgName) + '</h1>'
      +   '<p>ใบยืมหนังสือ · เอกสารยืนยันการยืม</p>'
      + '</div>'
      + '<div class="title">ใบยืม #' + esc(l.code) + '</div>'
      + '<table><tbody>'
      + '<tr><td class="lbl">หนังสือ</td><td><b>' + esc(b.title) + '</b></td></tr>'
      + '<tr><td class="lbl">ผู้แต่ง</td><td>' + esc(b.author) + '</td></tr>'
      + '<tr><td class="lbl">รหัสหนังสือ</td><td><b>' + esc(b.code) + '</b></td></tr>'
      + '<tr><td class="lbl">ผู้ยืม</td><td><b>' + esc(u.full_name) + '</b></td></tr>'
      + '<tr><td class="lbl">ห้อง/บทบาท</td><td>' + esc(u.class_name || H.roleLabel(u.role)) + '</td></tr>'
      + '<tr><td class="lbl">วันที่ยืม</td><td>' + esc(TH.dateLong(l.borrowed_at)) + ' เวลา ' + esc(TH.time(l.borrowed_at)) + '</td></tr>'
      + '<tr><td class="lbl">ครบกำหนดคืน</td><td><b style="color:#dc2626">' + esc(TH.dateLong(l.due_at)) + '</b></td></tr>'
      + '</tbody></table>'
      + '<div class="sign">'
      +   '<div class="box">ผู้ยืม<br><br><br>(...........................)</div>'
      +   '<div class="box">บรรณารักษ์<br><br><br>(...........................)</div>'
      + '</div>'
      + '<div class="footer">พิมพ์เมื่อ ' + esc(TH.dateTime(new Date())) + ' · ระบบ SLS v' + esc(Store.boot.app && Store.boot.app.version) + '</div>'
      + '<sc' + 'ript>setTimeout(function(){window.print()},300);</sc' + 'ript>'
      + '</body></html>';
    w.document.open(); w.document.write(html); w.document.close();
  }

  // ═══════════════════════════════════════════════════════════
  //  RESERVATIONS
  // ═══════════════════════════════════════════════════════════
  Routes['#/reservations'] = function () {
    var own = !H.hasCap('reservation.manage');
    var hero = H.heroHtml({
      icon: 'bi-bookmark-star-fill', pill: 'การจอง',
      title: own ? 'การจองของฉัน' : 'จัดการการจอง',
      sub: 'รายการจองหนังสือ',
      grad: 'linear-gradient(135deg,#a855f7,#7c3aed)'
    });
    H.pageWrap(hero + H.skBlock(120));
    window.call('reservation.list', own ? { user_id: 'self' } : {}).then(function (data) {
      if (!$('#page')) return;
      var html = hero;
      if (!data.items.length) {
        html += H.emptyState('ยังไม่มีการจอง', 'bi-bookmark-star');
      } else {
        html += '<div class="flex-col gap-3">' + data.items.map(function (r) {
          return '<div class="loan-card ' + (r.status === 'expired' ? 'overdue' : '') + '">'
            + '<div class="lc-cover" style="background-image:url(' + esc(r.book_cover || '') + ')">' + (r.book_cover ? '' : '<i class="bi bi-book"></i>') + '</div>'
            + '<div class="lc-body">'
            +   '<div class="lc-title">' + esc(r.book_title) + ' <span class="text-xs muted font-mono">(' + esc(r.book_code) + ')</span></div>'
            +   '<div class="lc-meta">'
            +     (own ? '' : '<span><i class="bi bi-person"></i> ' + esc(r.user_name) + '</span>')
            +     '<span><i class="bi bi-calendar"></i> จอง ' + esc(TH.date(r.reserved_at)) + '</span>'
            +     '<span><i class="bi bi-clock"></i> หมดอายุ ' + esc(TH.date(r.expires_at)) + '</span>'
            +   '</div>'
            +   '<div class="mt-2 flex gap-2 items-center" style="flex-wrap:wrap">'
            +     H.reservStatusBadge(r.status)
            +     (r.status === 'active' ? ' <button class="btn btn-sm btn-danger" data-rcancel="' + esc(r.id) + '"><i class="bi bi-x-circle"></i> ยกเลิก</button>' : '')
            +   '</div>'
            + '</div></div>';
        }).join('') + '</div>';
      }
      H.pageWrap(html);
      $$('[data-rcancel]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-rcancel');
          confirmModal({ title: 'ยกเลิกการจอง', message: 'ยืนยันยกเลิกการจอง?', danger: true }).then(function (ok) {
            if (!ok) return;
            window.call('reservation.cancel', { id: id }).then(function () {
              alertSuccess('ยกเลิกแล้ว');
              Routes['#/reservations']();
            }).catch(function (e) { alertError('ไม่สำเร็จ', e.message); });
          });
        });
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  };

  // ═══════════════════════════════════════════════════════════
  //  FINES
  // ═══════════════════════════════════════════════════════════
  Routes['#/fines'] = function () {
    if (!H.hasCap('fine.manage')) { toast('คุณไม่มีสิทธิ์', 'warning'); location.hash = '#/dashboard'; return; }
    renderFinesList(false);
  };
  Routes['#/my/fines'] = function () { renderFinesList(true); };

  function renderFinesList(own) {
    var hero = H.heroHtml({
      icon: 'bi-cash-coin', pill: own ? 'ค่าปรับของฉัน' : 'ค่าปรับ',
      title: own ? 'ค่าปรับของฉัน' : 'จัดการค่าปรับ',
      sub: 'รายการค่าปรับและการชำระ',
      grad: 'linear-gradient(135deg,#f59e0b,#d97706)'
    });
    H.pageWrap(hero + H.skBlock(120));
    window.call('fine.list', own ? { user_id: 'self' } : {}).then(function (data) {
      if (!$('#page')) return;
      var stats = '<div class="sd-stagger">'
        + H.statCard({ label: 'ค้างจ่ายทั้งหมด', value: '฿' + (data.total_unpaid || 0).toLocaleString(), color: 'g-rose', icon: 'bi-exclamation-circle-fill' })
        + H.statCard({ label: 'ชำระแล้ว', value: '฿' + (data.total_paid || 0).toLocaleString(), color: 'g-emerald', icon: 'bi-check-circle-fill' })
        + H.statCard({ label: 'จำนวนรายการ', value: data.total, color: 'g-indigo', icon: 'bi-receipt' })
        + '</div>';
      var list = '';
      if (!data.items.length) {
        list = H.emptyState(own ? 'ไม่มีค่าปรับ — เยี่ยมมาก!' : 'ยังไม่มีค่าปรับ', 'bi-emoji-smile');
      } else {
        list = '<div class="flex-col gap-3">' + data.items.map(function (f) {
          var paid = f.paid === 'yes';
          return '<div class="loan-card" style="border-left-color:' + (paid ? '#10b981' : '#f43f5e') + '">'
            + '<div class="lc-cover" style="background-image:url(' + esc(f.book_cover || '') + ')">' + (f.book_cover ? '' : '<i class="bi bi-book"></i>') + '</div>'
            + '<div class="lc-body">'
            +   '<div class="lc-title">' + esc(f.book_title) + '</div>'
            +   '<div class="lc-meta">'
            +     (own ? '' : '<span><i class="bi bi-person"></i> ' + esc(f.user_name) + '</span>')
            +     '<span><i class="bi bi-receipt"></i> ' + esc(f.loan_code) + '</span>'
            +     '<span><i class="bi bi-calendar"></i> ' + esc(TH.date(f.created_at)) + '</span>'
            +     (f.notes ? '<span><i class="bi bi-chat-quote"></i> ' + esc(f.notes) + '</span>' : '')
            +   '</div>'
            +   '<div class="mt-2 flex gap-2 items-center" style="flex-wrap:wrap;justify-content:space-between">'
            +     '<div><span class="badge ' + (paid ? 'b-paid' : 'b-unpaid') + '">' + (paid ? 'ชำระแล้ว' : 'ค้างจ่าย') + '</span> <b style="color:' + (paid ? '#047857' : '#dc2626') + ';font-size:18px;margin-left:6px">฿' + f.amount + '</b></div>'
            +     (!paid && H.hasCap('fine.manage') ? '<div class="flex gap-2"><button class="btn btn-success btn-sm" data-fpay="' + esc(f.id) + '"><i class="bi bi-cash-coin"></i> รับชำระ</button>'
            +       '<button class="btn btn-ghost btn-sm" data-fwaive="' + esc(f.id) + '"><i class="bi bi-slash-circle"></i> ยกเว้น</button></div>' : '')
            +   '</div>'
            + '</div></div>';
        }).join('') + '</div>';
      }
      H.pageWrap(hero + stats + list);
      $$('[data-fpay]').forEach(function (b) {
        b.addEventListener('click', function () {
          openFinePayModal(b.getAttribute('data-fpay'));
        });
      });
      $$('[data-fwaive]').forEach(function (b) {
        b.addEventListener('click', function () {
          promptModal({ title: 'ยกเว้นค่าปรับ', message: 'ระบุเหตุผล', required: true }).then(function (reason) {
            if (!reason) return;
            window.call('fine.waive', { id: b.getAttribute('data-fwaive'), reason: reason }).then(function () {
              alertSuccess('ยกเว้นเรียบร้อย');
              renderFinesList(own);
            }).catch(function (e) { alertError('ไม่สำเร็จ', e.message); });
          });
        });
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function openFinePayModal(fineId) {
    window.call('paymentMethod.list', { activeOnly: true }).then(function (data) {
      var methods = data.items || [];
      var cards = methods.map(function (m, i) {
        return '<label class="lf-demo-card pm-pick" data-key="' + esc(m.key) + '" data-req-ref="' + (m.requires_reference === 'yes' ? '1' : '0') + '" data-req-slip="' + (m.requires_slip === 'yes' ? '1' : '0') + '" style="cursor:pointer;background:#fff;border:2px solid #e2e8f0' + (i === 0 ? ';border-color:#6366f1' : '') + '">'
          + '<div class="lf-demo-icon" style="background:' + esc(m.color || '#6366f1') + ';color:#fff"><i class="bi ' + esc(m.icon || 'bi-credit-card') + '"></i></div>'
          + '<div class="lf-demo-role" style="color:#1e293b">' + esc(m.label) + '</div>'
          + '<div class="lf-demo-user" style="color:#64748b">' + (m.requires_reference === 'yes' ? '<i class="bi bi-hash"></i> Ref' : '') + ' ' + (m.requires_slip === 'yes' ? '<i class="bi bi-receipt"></i> Slip' : '') + '</div>'
          + '</label>';
      }).join('');
      Modal.open({
        title: 'รับชำระค่าปรับ',
        titleIcon: 'bi-cash-coin',
        html: '<form id="pf-form">'
          + '<div class="field"><label>เลือกช่องทางชำระ</label>'
          + '<div class="lf-demo-grid">' + cards + '</div></div>'
          + '<div class="field" id="pf-ref-wrap"><label>เลขอ้างอิง<span class="req" id="pf-ref-req" style="display:none">*</span></label><input class="input" name="reference"></div>'
          + '<div class="field" id="pf-slip-wrap"><label>สลิป<span class="req" id="pf-slip-req" style="display:none">*</span></label>'
          +   '<div class="flex gap-2 items-center"><input class="input" name="slip_url" placeholder="URL หรืออัปโหลด"><input type="file" id="pf-slip-file" accept="image/*" style="display:none"><button type="button" class="btn" id="pf-slip-btn"><i class="bi bi-camera"></i> ถ่ายภาพ</button></div>'
          + '</div>'
          + '<div class="field"><label>หมายเหตุ</label><textarea class="textarea" name="notes" rows="2"></textarea></div>'
          + '</form>',
        footer: '<button class="btn" data-modal-close type="button">ยกเลิก</button>'
          + '<button class="btn btn-success" type="button" id="pf-submit"><i class="bi bi-check-circle"></i> ยืนยันชำระ</button>',
        onOpen: function (host) {
          var selectedKey = methods.length ? methods[0].key : '';
          function applyReqs(card) {
            var rr = card.getAttribute('data-req-ref') === '1';
            var rs = card.getAttribute('data-req-slip') === '1';
            $('#pf-ref-req', host).style.display = rr ? 'inline' : 'none';
            $('#pf-slip-req', host).style.display = rs ? 'inline' : 'none';
          }
          $$('.pm-pick', host).forEach(function (c) {
            c.addEventListener('click', function () {
              $$('.pm-pick', host).forEach(function (x) { x.style.borderColor = '#e2e8f0'; });
              c.style.borderColor = '#6366f1';
              selectedKey = c.getAttribute('data-key');
              applyReqs(c);
            });
          });
          if (methods.length) applyReqs($$('.pm-pick', host)[0]);
          var fileInput = $('#pf-slip-file', host);
          $('#pf-slip-btn', host).addEventListener('click', function () { fileInput.click(); });
          fileInput.addEventListener('change', function () {
            if (!fileInput.files.length) return;
            Spinner.show('กำลังอัปโหลดสลิป');
            H.uploadFile(fileInput.files[0], 'slips').then(function (r) {
              Spinner.hide();
              host.querySelector('input[name="slip_url"]').value = r.url;
              toast('อัปโหลดสำเร็จ', 'success');
            }).catch(function (e) { Spinner.hide(); toast(e.message, 'error'); });
          });
          $('#pf-submit', host).addEventListener('click', function () {
            var f = $('#pf-form', host);
            Spinner.show('กำลังบันทึก', { stages: ['ตรวจสอบ', 'บันทึก', 'เสร็จสิ้น'] });
            window.call('fine.pay', { id: fineId, method_key: selectedKey, reference: f.reference.value, slip_url: f.slip_url.value, notes: f.notes.value }).then(function () {
              Spinner.hide();
              Modal.close();
              alertSuccess('รับชำระเรียบร้อย');
              location.hash === '#/my/fines' ? renderFinesList(true) : renderFinesList(false);
            }).catch(function (e) { Spinner.hide(); alertError('ไม่สำเร็จ', e.message); });
          });
        }
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  // ═══════════════════════════════════════════════════════════
  //  USERS
  // ═══════════════════════════════════════════════════════════
  var USERS_STATE = { q: '', role: '' };

  Routes['#/users'] = function () {
    if (!H.hasCap('user.view_all|user.manage')) { toast('คุณไม่มีสิทธิ์', 'warning'); location.hash = '#/dashboard'; return; }
    var hero = H.heroHtml({
      icon: 'bi-people-fill', pill: 'ผู้ใช้งาน',
      title: 'จัดการผู้ใช้งาน',
      sub: 'จัดการบัญชี · กำหนดบทบาท · เปิด/ปิดใช้งาน',
      grad: 'linear-gradient(135deg,#ec4899,#db2777)'
    });
    var roleChips = '<button class="chip ' + (USERS_STATE.role === '' ? 'active' : '') + '" data-role="">ทุกบทบาท</button>'
      + ['admin','librarian','teacher','student'].map(function (r) {
        return '<button class="chip ' + (USERS_STATE.role === r ? 'active' : '') + '" data-role="' + r + '">' + esc(H.roleLabel(r)) + '</button>';
      }).join('');
    var manage = H.hasCap('user.manage');
    var toolbar = '<div class="toolbar">'
      + '<div class="search-box"><i class="bi bi-search"></i><input class="input" placeholder="ค้นหา ชื่อ, username, ห้อง" id="us-q" value="' + esc(USERS_STATE.q) + '"></div>'
      + '<div class="filters">' + roleChips + '</div>'
      + (manage ? '<button class="btn" id="us-cards" style="margin-left:auto"><i class="bi bi-person-badge"></i> พิมพ์บัตร</button>' : '')
      + (manage ? '<button class="btn btn-primary" id="us-new"><i class="bi bi-plus-lg"></i> เพิ่มผู้ใช้</button>' : '')
      + '</div>';
    H.pageWrap(hero + toolbar + '<div id="us-list">' + H.skBlock(80) + H.skBlock(80) + '</div>');
    var dbn = null;
    $('#us-q').addEventListener('input', function () {
      clearTimeout(dbn); dbn = setTimeout(function () { USERS_STATE.q = $('#us-q').value.trim(); loadUsers(); }, 300);
    });
    $$('.chip[data-role]').forEach(function (c) {
      c.addEventListener('click', function () { USERS_STATE.role = c.getAttribute('data-role') || ''; Routes['#/users'](); });
    });
    if (manage) $('#us-new').addEventListener('click', function () { openUserEditModal(null); });
    if (manage) { var _uc = $('#us-cards'); if (_uc) _uc.addEventListener('click', function () { if (window.SLS_openCardSheet) window.SLS_openCardSheet(); }); }
    loadUsers();
  };

  function loadUsers() {
    var list = $('#us-list');
    if (!list) return;
    list.innerHTML = H.skBlock(80) + H.skBlock(80);
    window.call('user.list', { q: USERS_STATE.q, role: USERS_STATE.role }).then(function (data) {
      if (!$('#us-list')) return;
      var manage = H.hasCap('user.manage');
      if (!data.items.length) {
        $('#us-list').innerHTML = H.emptyState('ไม่พบผู้ใช้', 'bi-person-x');
        return;
      }
      $('#us-list').innerHTML = '<div style="overflow-x:auto"><table class="data-table"><thead><tr>'
        + '<th></th><th>ชื่อ-ผู้ใช้</th><th>บทบาท</th><th>ห้อง/เลขที่</th><th>ติดต่อ</th><th>สถานะ</th>' + (manage ? '<th></th>' : '') + '</tr></thead><tbody>'
        + data.items.map(function (u) {
          return '<tr>'
            + '<td><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;' + H.avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(H.initials(u.full_name))) + '</div></td>'
            + '<td><div class="font-bold">' + esc(u.full_name) + '</div><div class="text-xs muted">' + esc(u.username) + '</div></td>'
            + '<td><span class="role-chip role-chip-' + esc(u.role) + '"><i class="bi bi-shield-check-fill"></i>' + esc(H.roleLabel(u.role)) + '</span></td>'
            + '<td><div class="text-sm">' + esc(u.class_name || '-') + '</div>' + (u.student_no ? '<div class="text-xs muted">' + esc(u.student_no) + '</div>' : '') + '</td>'
            + '<td><div class="text-xs">' + esc(u.email || '-') + '</div><div class="text-xs muted">' + esc(u.phone || '') + '</div></td>'
            + '<td>' + (u.is_active ? '<span class="badge b-paid">เปิดใช้</span>' : '<span class="badge b-unpaid">ปิดใช้</span>') + '</td>'
            + (manage ? '<td><div class="flex gap-2"><button class="btn btn-sm" data-ucard="' + esc(u.id) + '" title="บัตรห้องสมุด"><i class="bi bi-person-badge"></i></button><button class="btn btn-sm" data-uedit="' + esc(u.id) + '"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-danger" data-udel="' + esc(u.id) + '"><i class="bi bi-trash"></i></button></div></td>' : '')
            + '</tr>';
        }).join('') + '</tbody></table></div>';
      $$('[data-uedit]').forEach(function (b) {
        b.addEventListener('click', function () {
          var u = data.items.find(function (x) { return x.id === b.getAttribute('data-uedit'); });
          openUserEditModal(u);
        });
      });
      $$('[data-ucard]').forEach(function (b) {
        b.addEventListener('click', function () {
          var u = data.items.find(function (x) { return x.id === b.getAttribute('data-ucard'); });
          if (window.SLS_openCardModal) window.SLS_openCardModal(u);
        });
      });
      $$('[data-udel]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-udel');
          var u = data.items.find(function (x) { return x.id === id; });
          confirmModal({ title: 'ลบผู้ใช้', message: 'ลบบัญชี ' + (u ? u.full_name : '') + '? (จะลบไม่ได้ถ้ามีการยืมค้าง)', danger: true }).then(function (ok) {
            if (!ok) return;
            window.call('user.delete', { id: id }).then(function () {
              alertSuccess('ลบเรียบร้อย');
              loadUsers();
            }).catch(function (e) { alertError('ลบไม่สำเร็จ', e.message); });
          });
        });
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function openUserEditModal(u) {
    var isEdit = !!u;
    Modal.open({
      title: isEdit ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่',
      titleIcon: isEdit ? 'bi-pencil-square' : 'bi-person-plus-fill',
      html: '<form id="us-form">'
        + '<div class="field-row">'
        +   '<div class="field"><label>ชื่อผู้ใช้ (username)<span class="req">*</span></label><input class="input" name="username" required value="' + esc(u ? u.username : '') + '"' + (isEdit ? ' readonly style="background:#f1f5f9"' : '') + '><div class="field-hint">a-z, 0-9, _, . (3-30 ตัวอักษร)</div></div>'
        +   '<div class="field"><label>บทบาท<span class="req">*</span></label><select class="select" name="role" required>'
        +     ['admin','librarian','teacher','student'].map(function (r) {
                return '<option value="' + r + '"' + (u && u.role === r ? ' selected' : (!u && r === 'student' ? ' selected' : '')) + '>' + esc(H.roleLabel(r)) + '</option>';
              }).join('')
        +   '</select></div>'
        + '</div>'
        + '<div class="field"><label>ชื่อ-นามสกุล<span class="req">*</span></label><input class="input" name="full_name" required value="' + esc(u ? u.full_name : '') + '"></div>'
        + '<div class="field-row">'
        +   '<div class="field"><label>อีเมล</label><input class="input" type="email" name="email" value="' + esc(u ? u.email : '') + '"></div>'
        +   '<div class="field"><label>เบอร์โทร</label><input class="input" name="phone" inputmode="tel" value="' + esc(u ? u.phone : '') + '"></div>'
        + '</div>'
        + '<div class="field-row">'
        +   '<div class="field"><label>ห้อง</label><input class="input" name="class_name" placeholder="เช่น ม.5/1" value="' + esc(u ? u.class_name : '') + '"></div>'
        +   '<div class="field"><label>เลขประจำตัว</label><input class="input" name="student_no" value="' + esc(u ? u.student_no : '') + '"></div>'
        + '</div>'
        + '<div class="field"><label>' + (isEdit ? 'ตั้งรหัสผ่านใหม่ (ปล่อยว่าง = ไม่เปลี่ยน)' : 'รหัสผ่าน') + (!isEdit ? '<span class="req">*</span>' : '') + '</label><input class="input" type="password" name="password"' + (!isEdit ? ' required minlength="6"' : '') + ' minlength="6"><div class="field-hint">อย่างน้อย 6 ตัวอักษร</div></div>'
        + '<div class="field"><label>URL รูปโปรไฟล์</label>'
        +   '<div class="flex gap-2"><input class="input" name="avatar_url" value="' + esc(u ? u.avatar_url : '') + '" placeholder="https://..."><input type="file" id="us-avatar-file" accept="image/*" style="display:none"><button type="button" class="btn" id="us-avatar-btn"><i class="bi bi-upload"></i></button></div>'
        + '</div>'
        + (isEdit ? '<div class="field"><label class="lf-check" style="display:inline-flex;color:#475569"><input type="checkbox" name="is_active" ' + (u && u.is_active ? 'checked' : '') + '><span class="lf-check-box"></span><span>เปิดใช้งาน</span></label></div>' : '')
        + '</form>',
      footer: '<button class="btn" data-modal-close type="button">ยกเลิก</button><button class="btn btn-primary" type="button" id="us-save"><i class="bi bi-check-circle"></i> บันทึก</button>',
      onOpen: function (host) {
        var fileInput = $('#us-avatar-file', host);
        $('#us-avatar-btn', host).addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
          if (!fileInput.files.length) return;
          Spinner.show('กำลังอัปโหลด');
          H.uploadFile(fileInput.files[0], 'avatars').then(function (r) {
            Spinner.hide();
            host.querySelector('input[name="avatar_url"]').value = r.url;
            toast('อัปโหลดสำเร็จ', 'success');
          }).catch(function (e) { Spinner.hide(); toast(e.message, 'error'); });
        });
        $('#us-save', host).addEventListener('click', function () {
          var f = $('#us-form', host);
          var data = {};
          ['username','role','full_name','email','phone','class_name','student_no','avatar_url','password'].forEach(function (k) {
            if (f[k]) data[k] = f[k].value;
          });
          if (isEdit) {
            data.id = u.id;
            data.is_active = f.is_active.checked;
            if (!data.password) delete data.password;
          }
          Spinner.show(isEdit ? 'กำลังอัปเดต' : 'กำลังเพิ่มผู้ใช้', { stages: ['ตรวจสอบ', 'บันทึก', 'เสร็จสิ้น'] });
          window.call(isEdit ? 'user.update' : 'user.create', data).then(function () {
            Spinner.hide();
            Modal.close();
            alertSuccess(isEdit ? 'อัปเดตเรียบร้อย' : 'เพิ่มผู้ใช้เรียบร้อย');
            loadUsers();
          }).catch(function (e) { Spinner.hide(); alertError('ไม่สำเร็จ', e.message); });
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  CATEGORIES
  // ═══════════════════════════════════════════════════════════
  Routes['#/categories'] = function () {
    if (!H.hasCap('category.manage')) { toast('คุณไม่มีสิทธิ์', 'warning'); location.hash = '#/dashboard'; return; }
    var hero = H.heroHtml({
      icon: 'bi-tags-fill', pill: 'หมวดหนังสือ',
      title: 'จัดการหมวดหนังสือ',
      sub: 'เพิ่ม · แก้ไข · เปิด-ปิด · จัดลำดับ',
      grad: 'linear-gradient(135deg,#14b8a6,#0d9488)'
    });
    H.pageWrap(hero + '<div class="flex justify-end mb-4"><button class="btn btn-primary" id="ct-new"><i class="bi bi-plus-lg"></i> เพิ่มหมวด</button></div><div id="ct-list">' + H.skBlock(100) + '</div>');
    $('#ct-new').addEventListener('click', function () { openCategoryEditModal(null); });
    loadCategories();
  };

  function loadCategories() {
    window.call('category.list', { active_only: false }).then(function (data) {
      var manage = H.hasCap('category.manage');
      if (!$('#ct-list')) return;
      $('#ct-list').innerHTML = '<div class="book-grid">' + data.items.map(function (c) {
        return '<div class="sd-stat" style="opacity:' + (c.is_active === 'yes' ? '1' : '.55') + '">'
          + '<div class="sd-stat-row">'
          +   '<div class="sd-stat-icon" style="background:' + esc(c.color) + '"><i class="bi ' + esc(c.icon) + '"></i></div>'
          +   '<div class="flex gap-2">'
          +     (manage ? '<button class="btn btn-sm" data-ctedit="' + esc(c.id) + '"><i class="bi bi-pencil"></i></button>' : '')
          +     (manage ? '<button class="btn btn-sm" data-cttoggle="' + esc(c.id) + '"><i class="bi bi-' + (c.is_active === 'yes' ? 'toggle2-on' : 'toggle2-off') + '"></i></button>' : '')
          +     (manage ? '<button class="btn btn-sm btn-danger" data-ctdel="' + esc(c.id) + '"><i class="bi bi-trash"></i></button>' : '')
          +   '</div>'
          + '</div>'
          + '<div class="sd-stat-value">' + esc(c.label) + '</div>'
          + '<div class="sd-stat-sub"><span class="font-mono">' + esc(c.key) + '</span></div>'
          + (c.description ? '<div class="text-xs muted mt-2">' + esc(c.description) + '</div>' : '')
          + '</div>';
      }).join('') + '</div>';
      $$('[data-ctedit]').forEach(function (b) {
        b.addEventListener('click', function () {
          var c = data.items.find(function (x) { return x.id === b.getAttribute('data-ctedit'); });
          openCategoryEditModal(c);
        });
      });
      $$('[data-cttoggle]').forEach(function (b) {
        b.addEventListener('click', function () {
          window.call('category.toggle', { id: b.getAttribute('data-cttoggle') }).then(function () {
            loadCategories();
          }).catch(function (e) { alertError('ไม่สำเร็จ', e.message); });
        });
      });
      $$('[data-ctdel]').forEach(function (b) {
        b.addEventListener('click', function () {
          confirmModal({ title: 'ลบหมวด', message: 'ลบหมวดนี้? (ห้ามลบถ้ามีหนังสือใช้อยู่)', danger: true }).then(function (ok) {
            if (!ok) return;
            window.call('category.delete', { id: b.getAttribute('data-ctdel') }).then(function () {
              alertSuccess('ลบเรียบร้อย');
              loadCategories();
            }).catch(function (e) { alertError('ไม่สำเร็จ', e.message); });
          });
        });
      });
    });
  }

  function openCategoryEditModal(c) {
    var isEdit = !!c;
    var iconList = ['bi-tag-fill','bi-book-half','bi-book','bi-pen-fill','bi-globe','bi-calculator-fill','bi-flask','bi-translate','bi-people-fill','bi-cpu-fill','bi-music-note-beamed','bi-heart-pulse-fill','bi-emoji-smile-fill','bi-bookmark-star-fill','bi-stars','bi-trophy-fill','bi-palette-fill','bi-controller','bi-camera-fill','bi-cup-hot-fill'];
    var colorList = ['#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#ef4444','#f59e0b','#eab308','#84cc16','#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#64748b','#0f172a'];
    var iconPicker = '<div class="flex" style="flex-wrap:wrap;gap:4px;max-height:160px;overflow-y:auto;padding:6px;background:#f8fafc;border-radius:8px">'
      + iconList.map(function (ic) {
        return '<button type="button" class="btn btn-sm ct-icon-pick" data-icon="' + esc(ic) + '" style="width:36px;height:36px;padding:0;' + (c && c.icon === ic ? 'border-color:#6366f1;background:#eef2ff' : '') + '"><i class="bi ' + esc(ic) + '"></i></button>';
      }).join('') + '</div>';
    var colorPicker = '<div class="flex" style="flex-wrap:wrap;gap:4px">'
      + colorList.map(function (col) {
        return '<button type="button" class="ct-color-pick" data-color="' + esc(col) + '" style="width:30px;height:30px;border-radius:50%;border:2px solid #fff;outline:1px solid #cbd5e1;cursor:pointer;background:' + esc(col) + ';' + (c && c.color === col ? 'outline-color:#6366f1;outline-width:2px' : '') + '"></button>';
      }).join('') + '</div>';
    Modal.open({
      title: isEdit ? 'แก้ไขหมวด' : 'เพิ่มหมวดใหม่',
      titleIcon: 'bi-tags-fill',
      html: '<form id="ct-form">'
        + '<div class="field-row">'
        +   '<div class="field"><label>Key<span class="req">*</span></label><input class="input" name="key" required value="' + esc(c ? c.key : '') + '" pattern="[a-z0-9_-]+" maxlength="30"' + (isEdit ? ' readonly style="background:#f1f5f9"' : '') + '></div>'
        +   '<div class="field"><label>ชื่อ<span class="req">*</span></label><input class="input" name="label" required value="' + esc(c ? c.label : '') + '"></div>'
        + '</div>'
        + '<div class="field"><label>ไอคอน</label>' + iconPicker + '<input type="hidden" name="icon" value="' + esc(c ? c.icon : 'bi-tag-fill') + '"></div>'
        + '<div class="field"><label>สี</label>' + colorPicker + '<input type="hidden" name="color" value="' + esc(c ? c.color : '#6366f1') + '"></div>'
        + '<div class="field"><label>ลำดับ</label><input class="input" type="number" name="sort_order" value="' + esc(c ? c.sort_order : '100') + '"></div>'
        + '<div class="field"><label>คำอธิบาย</label><textarea class="textarea" name="description">' + esc(c ? c.description : '') + '</textarea></div>'
        + '</form>',
      footer: '<button class="btn" data-modal-close type="button">ยกเลิก</button><button class="btn btn-primary" type="button" id="ct-save"><i class="bi bi-check-circle"></i> บันทึก</button>',
      onOpen: function (host) {
        $$('.ct-icon-pick', host).forEach(function (b) {
          b.addEventListener('click', function () {
            $$('.ct-icon-pick', host).forEach(function (x) { x.style.borderColor = ''; x.style.background = ''; });
            b.style.borderColor = '#6366f1'; b.style.background = '#eef2ff';
            host.querySelector('input[name="icon"]').value = b.getAttribute('data-icon');
          });
        });
        $$('.ct-color-pick', host).forEach(function (b) {
          b.addEventListener('click', function () {
            $$('.ct-color-pick', host).forEach(function (x) { x.style.outlineColor = '#cbd5e1'; x.style.outlineWidth = '1px'; });
            b.style.outlineColor = '#6366f1'; b.style.outlineWidth = '2px';
            host.querySelector('input[name="color"]').value = b.getAttribute('data-color');
          });
        });
        $('#ct-save', host).addEventListener('click', function () {
          var f = $('#ct-form', host);
          var data = {};
          ['key','label','icon','color','sort_order','description'].forEach(function (k) { data[k] = f[k].value; });
          if (isEdit) { data.id = c.id; data.is_active = c.is_active === 'yes'; }
          Spinner.show(isEdit ? 'กำลังอัปเดต' : 'กำลังเพิ่มหมวด');
          window.call('category.upsert', data).then(function () {
            Spinner.hide();
            Modal.close();
            alertSuccess(isEdit ? 'อัปเดตเรียบร้อย' : 'เพิ่มเรียบร้อย');
            loadCategories();
          }).catch(function (e) { Spinner.hide(); alertError('ไม่สำเร็จ', e.message); });
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  PAYMENT METHODS (similar to categories)
  // ═══════════════════════════════════════════════════════════
  Routes['#/payment-methods'] = function () {
    if (!H.hasCap('paymentMethod.manage')) { toast('คุณไม่มีสิทธิ์', 'warning'); location.hash = '#/dashboard'; return; }
    var hero = H.heroHtml({
      icon: 'bi-credit-card-2-front-fill', pill: 'ช่องทางชำระ',
      title: 'จัดการช่องทางชำระ',
      sub: 'เพิ่ม · แก้ไข · เปิด-ปิด ช่องทางรับชำระค่าปรับ',
      grad: 'linear-gradient(135deg,#0ea5e9,#0284c7)'
    });
    H.pageWrap(hero + '<div class="flex justify-end mb-4"><button class="btn btn-primary" id="pm-new"><i class="bi bi-plus-lg"></i> เพิ่มช่องทาง</button></div><div id="pm-list">' + H.skBlock(100) + '</div>');
    $('#pm-new').addEventListener('click', function () { openPaymentMethodModal(null); });
    loadPaymentMethods();
  };
  function loadPaymentMethods() {
    window.call('paymentMethod.list', { activeOnly: false }).then(function (data) {
      $('#pm-list').innerHTML = '<div class="book-grid">' + data.items.map(function (m) {
        return '<div class="sd-stat" style="opacity:' + (m.is_active === 'yes' ? '1' : '.55') + '">'
          + '<div class="sd-stat-row">'
          +   '<div class="sd-stat-icon" style="background:' + esc(m.color) + '"><i class="bi ' + esc(m.icon) + '"></i></div>'
          +   '<div class="flex gap-2">'
          +     '<button class="btn btn-sm" data-pmedit="' + esc(m.id) + '"><i class="bi bi-pencil"></i></button>'
          +     '<button class="btn btn-sm" data-pmtoggle="' + esc(m.id) + '"><i class="bi bi-' + (m.is_active === 'yes' ? 'toggle2-on' : 'toggle2-off') + '"></i></button>'
          +     '<button class="btn btn-sm btn-danger" data-pmdel="' + esc(m.id) + '"><i class="bi bi-trash"></i></button>'
          +   '</div>'
          + '</div>'
          + '<div class="sd-stat-value">' + esc(m.label) + '</div>'
          + '<div class="sd-stat-sub flex gap-2 mt-2" style="flex-wrap:wrap">'
          +   (m.requires_reference === 'yes' ? '<span class="badge b-active">Ref</span>' : '')
          +   (m.requires_slip === 'yes' ? '<span class="badge b-borrowed">Slip</span>' : '')
          + '</div>'
          + '</div>';
      }).join('') + '</div>';
      $$('[data-pmedit]').forEach(function (b) {
        b.addEventListener('click', function () { openPaymentMethodModal(data.items.find(function (x) { return x.id === b.getAttribute('data-pmedit'); })); });
      });
      $$('[data-pmtoggle]').forEach(function (b) {
        b.addEventListener('click', function () { window.call('paymentMethod.toggle', { id: b.getAttribute('data-pmtoggle') }).then(loadPaymentMethods); });
      });
      $$('[data-pmdel]').forEach(function (b) {
        b.addEventListener('click', function () {
          confirmModal({ title: 'ลบ', message: 'ลบช่องทางนี้?', danger: true }).then(function (ok) {
            if (!ok) return;
            window.call('paymentMethod.delete', { id: b.getAttribute('data-pmdel') }).then(function () { alertSuccess('ลบแล้ว'); loadPaymentMethods(); }).catch(function (e) { alertError('ไม่สำเร็จ', e.message); });
          });
        });
      });
    });
  }
  function openPaymentMethodModal(m) {
    var isEdit = !!m;
    Modal.open({
      title: isEdit ? 'แก้ไขช่องทาง' : 'เพิ่มช่องทางใหม่',
      titleIcon: 'bi-credit-card-2-front-fill',
      html: '<form id="pm-form">'
        + '<div class="field-row">'
        +   '<div class="field"><label>Key<span class="req">*</span></label><input class="input" name="key" required value="' + esc(m ? m.key : '') + '" pattern="[a-z0-9_-]+"' + (isEdit ? ' readonly style="background:#f1f5f9"' : '') + '></div>'
        +   '<div class="field"><label>ชื่อ<span class="req">*</span></label><input class="input" name="label" required value="' + esc(m ? m.label : '') + '"></div>'
        + '</div>'
        + '<div class="field-row">'
        +   '<div class="field"><label>ไอคอน</label><input class="input" name="icon" value="' + esc(m ? m.icon : 'bi-credit-card-2-front-fill') + '" placeholder="bi-..."></div>'
        +   '<div class="field"><label>สี</label><input class="input" type="color" name="color" value="' + esc(m ? m.color : '#6366f1') + '"></div>'
        + '</div>'
        + '<div class="field-row">'
        +   '<div class="field"><label class="lf-check" style="display:inline-flex;color:#475569"><input type="checkbox" name="requires_reference" ' + (m && m.requires_reference === 'yes' ? 'checked' : '') + '><span class="lf-check-box"></span><span>ต้องระบุเลขอ้างอิง</span></label></div>'
        +   '<div class="field"><label class="lf-check" style="display:inline-flex;color:#475569"><input type="checkbox" name="requires_slip" ' + (m && m.requires_slip === 'yes' ? 'checked' : '') + '><span class="lf-check-box"></span><span>ต้องแนบสลิป</span></label></div>'
        + '</div>'
        + '<div class="field"><label>คำอธิบาย</label><textarea class="textarea" name="description">' + esc(m ? m.description : '') + '</textarea></div>'
        + '<div class="field"><label>ลำดับ</label><input class="input" type="number" name="sort_order" value="' + esc(m ? m.sort_order : '100') + '"></div>'
        + '</form>',
      footer: '<button class="btn" data-modal-close type="button">ยกเลิก</button><button class="btn btn-primary" type="button" id="pm-save"><i class="bi bi-check-circle"></i> บันทึก</button>',
      onOpen: function (host) {
        $('#pm-save', host).addEventListener('click', function () {
          var f = $('#pm-form', host);
          var data = { key: f.key.value, label: f.label.value, icon: f.icon.value, color: f.color.value, sort_order: f.sort_order.value, description: f.description.value, requires_reference: f.requires_reference.checked, requires_slip: f.requires_slip.checked };
          if (isEdit) { data.id = m.id; data.is_active = m.is_active === 'yes'; }
          Spinner.show('กำลังบันทึก');
          window.call('paymentMethod.upsert', data).then(function () { Spinner.hide(); Modal.close(); alertSuccess('บันทึกแล้ว'); loadPaymentMethods(); }).catch(function (e) { Spinner.hide(); alertError('ไม่สำเร็จ', e.message); });
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  REPORTS
  // ═══════════════════════════════════════════════════════════
  Routes['#/reports'] = function () {
    if (!H.hasCap('report.view_all')) { toast('คุณไม่มีสิทธิ์', 'warning'); location.hash = '#/dashboard'; return; }
    var hero = H.heroHtml({
      icon: 'bi-bar-chart-fill', pill: 'รายงาน',
      title: 'รายงานสรุปการใช้งาน',
      sub: 'สถิติ · แนวโน้ม · ยอดนิยม',
      grad: 'linear-gradient(135deg,#f97316,#ea580c)',
      actions: '<button class="btn btn-sm" style="background:rgba(255,255,255,.18);color:#fff;border-color:transparent" id="rp-print"><i class="bi bi-printer"></i> พิมพ์รายงาน</button>'
    });
    var rangeChips = [7,14,30,90,180,365].map(function (d) {
      return '<button class="chip rp-range" data-d="' + d + '">' + d + ' วัน</button>';
    }).join('');
    H.pageWrap(hero + '<div class="toolbar"><span class="text-sm muted">ช่วงเวลา:</span>' + rangeChips + '</div><div id="rp-content">' + H.skBlock(200) + '</div>');
    $('#rp-print').addEventListener('click', function () { window.print(); });
    var currentRange = 30;
    function loadRange(d) {
      currentRange = d;
      $$('.rp-range').forEach(function (b) { b.classList.toggle('active', parseInt(b.getAttribute('data-d'), 10) === d); });
      $('#rp-content').innerHTML = H.skBlock(200);
      window.call('report.overview', { range_days: d }).then(function (data) {
        if (!$('#rp-content')) return;
        var s = data.summary;
        var stats = '<div class="sd-stagger">'
          + H.statCard({ label: 'การยืมในช่วง ' + d + ' วัน', value: s.loans_in_range.toLocaleString(), color: 'g-indigo', icon: 'bi-arrow-up-circle' })
          + H.statCard({ label: 'กำลังยืม', value: s.active_loans.toLocaleString(), color: 'g-sky', icon: 'bi-card-checklist' })
          + H.statCard({ label: 'เกินกำหนด', value: s.overdue_loans.toLocaleString(), color: 'g-rose', icon: 'bi-exclamation-triangle' })
          + H.statCard({ label: 'หนังสือสูญหาย', value: s.lost_books.toLocaleString(), color: 'g-amber', icon: 'bi-x-circle' })
          + H.statCard({ label: 'หนังสือทั้งหมด', value: s.total_books.toLocaleString(), sub: 'รวมเล่ม ' + s.total_copies.toLocaleString(), color: 'g-emerald', icon: 'bi-book-half' })
          + H.statCard({ label: 'ผู้ใช้', value: s.total_users.toLocaleString(), color: 'g-violet', icon: 'bi-people' })
          + H.statCard({ label: 'ค่าปรับค้าง', value: '฿' + s.fine_unpaid.toLocaleString(), color: 'g-rose', icon: 'bi-cash-coin' })
          + H.statCard({ label: 'ค่าปรับที่ชำระแล้ว', value: '฿' + s.fine_paid.toLocaleString(), color: 'g-emerald', icon: 'bi-check-circle' })
          + '</div>';
        var trend = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-graph-up"></i> แนวโน้มการยืม-คืน</div>' + H.svgLine(data.trend) + '</div>';
        var byCatTotal = (data.by_category || []).reduce(function (s, c) { return s + (c.count || 0); }, 0);
        var byCat = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-pie-chart"></i> ยอดยืมตามหมวด</div>' + H.svgDonut(data.by_category, byCatTotal) + '</div>';
        var byClass = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-mortarboard"></i> ยอดยืมแยกตามห้อง</div>' + H.svgHorizBar((data.by_class || []).map(function (c) {
          return { label: c.class, count: c.count, color: '#6366f1' };
        })) + '</div>';
        var topBooks = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-trophy-fill"></i> หนังสือยอดนิยม</div><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>#</th><th>ชื่อหนังสือ</th><th>ผู้แต่ง</th><th>หมวด</th><th>ยอดยืม</th></tr></thead><tbody>'
          + data.top_books.map(function (b, i) {
            return '<tr><td><b style="color:' + (i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#64748b') + '">' + (i+1) + '</b></td><td>' + esc(b.title) + '</td><td>' + esc(b.author) + '</td><td>' + esc(b.category_key) + '</td><td><b>' + (b.borrow_count || 0) + '</b></td></tr>';
          }).join('') + '</tbody></table></div></div>';
        var topUsers = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-people-fill"></i> ผู้ยืมยอดนิยม</div><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>#</th><th>ชื่อ</th><th>ห้อง</th><th>บทบาท</th><th>ยอดยืม</th></tr></thead><tbody>'
          + data.top_borrowers.map(function (u, i) {
            return '<tr><td><b style="color:' + (i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#64748b') + '">' + (i+1) + '</b></td><td>' + esc(u.full_name) + '</td><td>' + esc(u.class_name || '-') + '</td><td><span class="role-chip role-chip-' + esc(u.role) + '">' + esc(H.roleLabel(u.role)) + '</span></td><td><b>' + u.count + '</b></td></tr>';
          }).join('') + '</tbody></table></div></div>';
        $('#rp-content').innerHTML = stats
          + '<div class="sd-grid-2">' + trend + byCat + '</div>'
          + '<div class="sd-grid-2">' + byClass + topBooks + '</div>'
          + topUsers
          + '<div class="text-center text-xs muted mt-4 sd-no-print">รายงานสร้างเมื่อ ' + esc(TH.dateTime(new Date())) + '</div>';
      }).catch(function (e) { toast(e.message, 'error'); });
    }
    $$('.rp-range').forEach(function (b) {
      b.addEventListener('click', function () { loadRange(parseInt(b.getAttribute('data-d'), 10)); });
    });
    loadRange(30);
  };

  // ═══════════════════════════════════════════════════════════
  //  AUDIT
  // ═══════════════════════════════════════════════════════════
  var AUDIT_STATE = { q: '', entity_type: '', page: 1 };
  Routes['#/audit'] = function () {
    if (!H.hasCap('audit.view_all|report.view_all')) { toast('คุณไม่มีสิทธิ์', 'warning'); location.hash = '#/dashboard'; return; }
    var hero = H.heroHtml({
      icon: 'bi-shield-check', pill: 'Audit Log',
      title: 'ประวัติการใช้งานระบบ',
      sub: 'บันทึกการเข้าใช้ · การเปลี่ยนแปลง · ความปลอดภัย',
      grad: 'linear-gradient(135deg,#64748b,#334155)'
    });
    var toolbar = '<div class="toolbar">'
      + '<div class="search-box"><i class="bi bi-search"></i><input class="input" placeholder="ค้นหา action, entity, meta" id="au-q" value="' + esc(AUDIT_STATE.q) + '"></div>'
      + '<select class="select" id="au-type" style="max-width:180px"><option value="">ทุก entity</option>'
      +   ['user','book','category','loan','reservation','fine','paymentMethod','setting','session','file','audit'].map(function (t) {
            return '<option value="' + t + '"' + (AUDIT_STATE.entity_type === t ? ' selected' : '') + '>' + t + '</option>';
          }).join('') + '</select>'
      + '</div>';
    H.pageWrap(hero + toolbar + '<div id="au-list">' + H.skBlock(100) + '</div><div id="au-pag" class="text-center mt-4"></div>');
    var dbn = null;
    $('#au-q').addEventListener('input', function () {
      clearTimeout(dbn); dbn = setTimeout(function () { AUDIT_STATE.q = $('#au-q').value.trim(); AUDIT_STATE.page = 1; loadAudit(); }, 300);
    });
    $('#au-type').addEventListener('change', function () { AUDIT_STATE.entity_type = $('#au-type').value; AUDIT_STATE.page = 1; loadAudit(); });
    loadAudit();
  };
  function loadAudit() {
    window.call('audit.list', { q: AUDIT_STATE.q, entity_type: AUDIT_STATE.entity_type, page: AUDIT_STATE.page, per_page: 30 }).then(function (data) {
      if (!$('#au-list')) return;
      if (!data.items.length) {
        $('#au-list').innerHTML = H.emptyState('ยังไม่มีบันทึก', 'bi-shield');
        $('#au-pag').innerHTML = '';
        return;
      }
      $('#au-list').innerHTML = '<div style="overflow-x:auto"><table class="data-table"><thead><tr><th>เวลา</th><th>ผู้กระทำ</th><th>การกระทำ</th><th>Entity</th><th>ID</th><th>Meta</th></tr></thead><tbody>'
        + data.items.map(function (a) {
          return '<tr><td><div class="text-xs muted">' + esc(TH.dateTime(a.ts)) + '</div></td>'
            + '<td><div class="text-sm font-bold">' + esc(a.user_name) + '</div><div class="text-xs muted">' + esc(H.roleLabel(a.user_role)) + '</div></td>'
            + '<td><span class="font-mono text-xs">' + esc(a.action) + '</span></td>'
            + '<td>' + esc(a.entity_type) + '</td>'
            + '<td><span class="font-mono text-xs muted">' + esc(String(a.entity_id || '').substring(0, 16)) + '</span></td>'
            + '<td><div class="font-mono text-xs muted" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.meta_json) + '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
      var pag = '';
      if (data.pages > 1) {
        pag = '<div class="flex justify-center gap-2 items-center">';
        if (data.page > 1) pag += '<button class="btn btn-sm" data-pg="' + (data.page - 1) + '"><i class="bi bi-chevron-left"></i></button>';
        pag += '<span class="text-sm muted">หน้า ' + data.page + ' / ' + data.pages + '</span>';
        if (data.page < data.pages) pag += '<button class="btn btn-sm" data-pg="' + (data.page + 1) + '"><i class="bi bi-chevron-right"></i></button>';
        pag += '</div>';
      }
      $('#au-pag').innerHTML = pag;
      $$('#au-pag [data-pg]').forEach(function (b) {
        b.addEventListener('click', function () {
          AUDIT_STATE.page = parseInt(b.getAttribute('data-pg'), 10);
          loadAudit();
        });
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  // ═══════════════════════════════════════════════════════════
  //  SETTINGS
  // ═══════════════════════════════════════════════════════════
  Routes['#/settings'] = function () {
    if (!H.hasCap('setting.manage')) { toast('คุณไม่มีสิทธิ์', 'warning'); location.hash = '#/dashboard'; return; }
    var hero = H.heroHtml({
      icon: 'bi-gear-fill', pill: 'ตั้งค่าระบบ',
      title: 'ตั้งค่าระบบ',
      sub: 'กำหนดนโยบายการยืม-คืน · องค์กร · การแจ้งเตือน',
      grad: 'linear-gradient(135deg,#64748b,#334155)'
    });
    H.pageWrap(hero + H.skBlock(300));
    window.call('setting.get', {}).then(function (s) {
      if (!$('#page')) return;
      var html = hero + '<form id="st-form" class="flex-col gap-4">'
        + '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-building"></i> ข้อมูลองค์กร</div>'
        +   '<div class="field-row">'
        +     '<div class="field"><label>ชื่อองค์กร/โรงเรียน</label><input class="input" name="org_name" value="' + esc(s.org_name) + '"></div>'
        +     '<div class="field"><label>ชื่อห้องสมุด</label><input class="input" name="library_name" value="' + esc(s.library_name) + '"></div>'
        +   '</div>'
        +   '<div class="field-row">'
        +     '<div class="field"><label>เบอร์โทร</label><input class="input" name="org_phone" value="' + esc(s.org_phone) + '"></div>'
        +     '<div class="field"><label>อีเมล</label><input class="input" name="org_email" value="' + esc(s.org_email) + '"></div>'
        +   '</div>'
        +   '<div class="field"><label>ที่อยู่</label><textarea class="textarea" name="org_address">' + esc(s.org_address) + '</textarea></div>'
        + '</div>'
        + '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-arrow-left-right"></i> นโยบายการยืม-คืน</div>'
        +   '<div class="field-row-3">'
        +     '<div class="field"><label>ระยะเวลายืม (วัน)</label><input class="input" type="number" min="1" max="365" name="max_borrow_days" value="' + esc(s.max_borrow_days) + '"></div>'
        +     '<div class="field"><label>จำนวนหนังสือสูงสุด/คน</label><input class="input" type="number" min="1" max="50" name="max_books_per_user" value="' + esc(s.max_books_per_user) + '"></div>'
        +     '<div class="field"><label>ค่าปรับ/วัน (บาท)</label><input class="input" type="number" min="0" step="0.5" name="fine_per_day" value="' + esc(s.fine_per_day) + '"></div>'
        +   '</div>'
        +   '<div class="field"><label>ระยะเวลาจองหนังสือก่อนหมดอายุ (วัน)</label><input class="input" type="number" min="1" max="30" name="reserve_hold_days" value="' + esc(s.reserve_hold_days) + '"></div>'
        + '</div>'
        + '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-shield-fill"></i> ความปลอดภัย · UX</div>'
        +   '<div class="field"><label>แสดงการ์ดบัญชีทดลองในหน้า Login</label>'
        +     '<select class="select" name="show_demo_users"><option value="yes"' + (s.show_demo_users === 'yes' ? ' selected' : '') + '>เปิด (โหมด Demo/Training)</option><option value="no"' + (s.show_demo_users !== 'yes' ? ' selected' : '') + '>ปิด (Production - แนะนำ)</option></select>'
        +     '<div class="field-hint">ปิดเมื่อใช้งานจริงเพื่อความปลอดภัย</div>'
        +   '</div>'
        +   '<div class="field"><label>อนุญาตให้สมัครสมาชิกเอง</label>'
        +     '<select class="select" name="allow_self_register"><option value="yes"' + (s.allow_self_register === 'yes' ? ' selected' : '') + '>เปิด</option><option value="no"' + (s.allow_self_register !== 'yes' ? ' selected' : '') + '>ปิด</option></select>'
        +   '</div>'
        + '</div>'
        + '<div class="flex justify-end gap-2"><button type="button" class="btn btn-primary btn-lg" id="st-save"><i class="bi bi-save"></i> บันทึกการตั้งค่า</button></div>'
        + '</form>'
        + '<div class="sd-panel" style="margin-top:16px;border:1px solid #fecaca;background:linear-gradient(135deg,#fff5f5,#fff)">'
        +   '<div class="sd-panel-title" style="color:#b91c1c"><i class="bi bi-exclamation-octagon-fill"></i> โซนอันตราย · ล้างข้อมูลเริ่มปีการศึกษาใหม่</div>'
        +   '<div class="text-xs muted mb-3">ลบ<b>ถาวร</b> กู้คืนไม่ได้ — หนังสือ หมวดหมู่ ช่องทางชำระ การตั้งค่า และบัญชีครู/บรรณารักษ์/ผู้ดูแล <b>จะไม่ถูกลบ</b> · แนะนำให้สำเนาไฟล์ Google Sheets เก็บไว้ก่อน (เปิดไฟล์ → File → Make a copy)</div>'
        +   '<div class="flex-col gap-2 mb-3" style="font-size:13px">'
        +     '<label class="lf-check" style="display:flex;color:#475569"><input type="checkbox" class="wipe-cb" value="loans" checked><span class="lf-check-box"></span><span>รายการยืมทั้งหมด <span class="muted">(คืนสต๊อกหนังสือเต็มจำนวนให้อัตโนมัติ)</span></span></label>'
        +     '<label class="lf-check" style="display:flex;color:#475569"><input type="checkbox" class="wipe-cb" value="fines" checked><span class="lf-check-box"></span><span>ค่าปรับทั้งหมด</span></label>'
        +     '<label class="lf-check" style="display:flex;color:#475569"><input type="checkbox" class="wipe-cb" value="reservations" checked><span class="lf-check-box"></span><span>การจองทั้งหมด</span></label>'
        +     '<label class="lf-check" style="display:flex;color:#475569"><input type="checkbox" class="wipe-cb" value="checkins" checked><span class="lf-check-box"></span><span>ประวัติเช็คชื่อเข้าใช้ทั้งหมด</span></label>'
        +     '<label class="lf-check" style="display:flex;color:#475569"><input type="checkbox" class="wipe-cb" value="audit"><span class="lf-check-box"></span><span>Audit log ทั้งหมด</span></label>'
        +     '<label class="lf-check" style="display:flex;color:#475569"><input type="checkbox" class="wipe-cb" value="book_stats"><span class="lf-check-box"></span><span>รีเซ็ตสถิติยอดยืมหนังสือ (นับหนังสือยอดนิยมใหม่)</span></label>'
        +     '<label class="lf-check" style="display:flex;color:#b91c1c"><input type="checkbox" class="wipe-cb" value="students"><span class="lf-check-box"></span><span><b>ลบบัญชีนักเรียนทั้งหมด</b> (เตรียมนำเข้ารุ่นใหม่ — บัตรเดิมจะใช้ไม่ได้)</span></label>'
        +   '</div>'
        +   '<div class="flex gap-2" style="flex-wrap:wrap;align-items:center">'
        +     '<input class="input" id="st-wipe-confirm" placeholder="พิมพ์คำว่า: ลบข้อมูล" style="max-width:220px" autocomplete="off">'
        +     '<button type="button" class="btn btn-danger" id="st-wipe"><i class="bi bi-trash3-fill"></i> ล้างข้อมูลที่เลือก</button>'
        +   '</div>'
        + '</div>';
      H.pageWrap(html);
      $('#st-save').addEventListener('click', function () {
        var f = $('#st-form');
        var updates = {};
        ['org_name','library_name','org_phone','org_email','org_address','max_borrow_days','max_books_per_user','fine_per_day','reserve_hold_days','show_demo_users','allow_self_register'].forEach(function (k) {
          if (f[k]) updates[k] = f[k].value;
        });
        Spinner.show('กำลังบันทึกการตั้งค่า', { stages: ['ตรวจสอบ', 'บันทึก', 'รีเฟรช'] });
        window.call('setting.update', { updates: updates }).then(function () {
          Spinner.hide();
          // Update Store.boot.settings (lite)
          Object.keys(updates).forEach(function (k) {
            Store.boot.settings[k] = updates[k];
          });
          alertSuccess('บันทึกแล้ว');
        }).catch(function (e) { Spinner.hide(); alertError('ไม่สำเร็จ', e.message); });
      });
      $('#st-wipe').addEventListener('click', function () {
        var targets = $$('.wipe-cb').filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
        if (!targets.length) return toast('เลือกข้อมูลที่จะลบอย่างน้อย 1 รายการ', 'warning');
        if ($('#st-wipe-confirm').value.trim() !== 'ลบข้อมูล') return toast('พิมพ์คำว่า "ลบข้อมูล" ในช่องยืนยันก่อน', 'warning');
        var names = { loans: 'รายการยืม', fines: 'ค่าปรับ', reservations: 'การจอง', checkins: 'เช็คชื่อ', audit: 'Audit log', book_stats: 'สถิติยอดยืม', students: 'บัญชีนักเรียนทั้งหมด' };
        confirmModal({
          title: 'ยืนยันลบถาวร?',
          message: 'จะลบ: ' + targets.map(function (t) { return names[t] || t; }).join(' · ') + ' — กู้คืนไม่ได้!',
          danger: true, okText: 'ลบถาวร', icon: 'warning'
        }).then(function (ok) {
          if (!ok) return;
          Spinner.show('กำลังล้างข้อมูล', { stages: ['ลบข้อมูล', 'คืนสต๊อกหนังสือ', 'ล้างแคช', 'เสร็จสิ้น'] });
          window.call('admin.clear_data', { targets: targets, confirm: 'ลบข้อมูล' }, 180000).then(function (r) {
            Spinner.hide();
            alertSuccess('ล้างข้อมูลเรียบร้อย', 'ลบแล้ว ' + ((r.cleared || []).length) + ' กลุ่มข้อมูล — พร้อมเริ่มปีการศึกษาใหม่');
            Routes['#/settings']();
          }).catch(function (e) { Spinner.hide(); alertError('ล้างข้อมูลไม่สำเร็จ', e.message); });
        });
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  };

  // ═══════════════════════════════════════════════════════════
  //  PROFILE
  // ═══════════════════════════════════════════════════════════
  Routes['#/profile'] = function () {
    var u = Store.user || {};
    var hero = H.heroHtml({
      icon: 'bi-person-circle', pill: 'โปรไฟล์',
      title: 'ข้อมูลส่วนตัว',
      sub: 'อัปเดตข้อมูลและรูปโปรไฟล์',
      grad: 'linear-gradient(135deg,#8b5cf6,#6d28d9)'
    });
    H.pageWrap(hero + '<div class="sd-panel">'
      + '<form id="pf-form">'
      +   '<div class="flex gap-3 items-center mb-6"><div id="pf-av-display" style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:28px;' + H.avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(H.initials(u.full_name))) + '</div>'
      +     '<div style="flex:1;min-width:0"><div class="font-bold text-sm">' + esc(u.username) + '</div><div class="text-xs muted">' + esc(H.roleLabel(u.role)) + '</div>'
      +       '<input type="file" id="pf-avatar-file" accept="image/*" style="display:none">'
      +       '<button type="button" class="btn btn-sm mt-2" id="pf-avatar-btn"><i class="bi bi-camera"></i> เปลี่ยนรูป</button></div></div>'
      +   '<div class="field"><label>ชื่อ-นามสกุล<span class="req">*</span></label><input class="input" name="full_name" required value="' + esc(u.full_name) + '"></div>'
      +   '<div class="field-row">'
      +     '<div class="field"><label>อีเมล</label><input class="input" type="email" name="email" value="' + esc(u.email || '') + '"></div>'
      +     '<div class="field"><label>เบอร์โทร</label><input class="input" name="phone" inputmode="tel" value="' + esc(u.phone || '') + '"></div>'
      +   '</div>'
      +   '<div class="field-row">'
      +     '<div class="field"><label>ห้อง</label><input class="input" name="class_name" value="' + esc(u.class_name || '') + '"></div>'
      +     '<div class="field"><label>เลขประจำตัว</label><input class="input" name="student_no" value="' + esc(u.student_no || '') + '"></div>'
      +   '</div>'
      +   '<input type="hidden" name="avatar_url" value="' + esc(u.avatar_url || '') + '">'
      +   '<div class="flex justify-end mt-4"><button type="button" class="btn btn-primary" id="pf-save"><i class="bi bi-save"></i> บันทึก</button></div>'
      + '</form>'
      + '</div>');
    $('#pf-avatar-btn').addEventListener('click', function () { $('#pf-avatar-file').click(); });
    $('#pf-avatar-file').addEventListener('change', function () {
      var f = $('#pf-avatar-file');
      if (!f.files.length) return;
      Spinner.show('กำลังอัปโหลด');
      H.uploadFile(f.files[0], 'avatars').then(function (r) {
        Spinner.hide();
        $('#pf-form input[name="avatar_url"]').value = r.url;
        $('#pf-av-display').style.backgroundImage = 'url(' + r.url + ')';
        $('#pf-av-display').style.backgroundSize = 'cover';
        $('#pf-av-display').textContent = '';
        toast('อัปโหลดสำเร็จ', 'success');
      }).catch(function (e) { Spinner.hide(); toast(e.message, 'error'); });
    });
    $('#pf-save').addEventListener('click', function () {
      var f = $('#pf-form');
      var data = {};
      ['full_name','email','phone','class_name','student_no','avatar_url'].forEach(function (k) { data[k] = f[k].value; });
      Spinner.show('กำลังบันทึก', { stages: ['ตรวจสอบ', 'บันทึก', 'รีเฟรช'] });
      window.call('user.update', data).then(function (newU) {
        Spinner.hide();
        // Update Store.user
        Store.user = Object.assign({}, Store.user, newU);
        try { localStorage.setItem('sls.session', JSON.stringify({ token: Store.token, user: Store.user, caps: Store.caps })); } catch (e) {}
        alertSuccess('อัปเดตเรียบร้อย');
        if (window.SLS_refreshNavbar) window.SLS_refreshNavbar();
      }).catch(function (e) { Spinner.hide(); alertError('ไม่สำเร็จ', e.message); });
    });
  };

  // Re-export Routes for resilience
  window.Routes = Routes;
  // If core boot already started before pages module, re-dispatch
  if (Store.user && location.hash) {
    setTimeout(function () { window.SLS_dispatch && window.SLS_dispatch(); }, 30);
  }
})();

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 3: CHECK-IN (เช็คชื่อเข้าใช้) + LIBRARY CARDS (บัตรห้องสมุด)
 *  เพิ่มใน v1.2 — ต้องใช้คู่กับ Code.gs v2.2 ขึ้นไป
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var H = window.SLS;
  var $ = H.$, $$ = H.$$, esc = H.esc;
  var Store = H.Store;
  var Routes = H.Routes;

  // ── ลงทะเบียนเมนู + หัวเพจ ──
  window.PAGE_META['#/checkin'] = { title: 'เช็คชื่อเข้าใช้', sub: 'บันทึกการเข้าใช้ห้องสมุด', icon: 'bi-person-check-fill' };
  window.PAGE_META['#/kiosk']   = { title: 'เช็คชื่อ', sub: 'โหมดคีออส', icon: 'bi-person-check-fill' };
  try {
    window.MENU_GROUPS.forEach(function (g) {
      if (g.title === 'งานหลัก') {
        g.items.splice(1, 0, { hash: '#/checkin', icon: 'bi-person-check-fill', label: 'เช็คชื่อเข้าใช้', cap: 'checkin.manage|loan.manage' });
      }
    });
  } catch (e) {}

  function todayISO() { return TH.iso(new Date()); }
  function beep(type) {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = type === 'error' ? 200 : (type === 'dup' ? 500 : 880);
      o.type = 'sine';
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      o.start(); o.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }
  // เสียงพูดภาษาไทย (Web Speech API)
  function speak(text) {
    try {
      if (!('speechSynthesis' in window) || !text) return;
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'th-TH';
      u.rate = 1;
      u.pitch = 1;
      var vs = window.speechSynthesis.getVoices() || [];
      for (var i = 0; i < vs.length; i++) {
        if ((vs[i].lang || '').toLowerCase().indexOf('th') === 0) { u.voice = vs[i]; break; }
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  // โหลดรายชื่อเสียงล่วงหน้า (บางเบราว์เซอร์โหลดแบบ async)
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function () {};
    }
  } catch (e) {}

  // ── ตัวสแกนกล้อง (โหลด html5-qrcode แบบ lazy) ──
  var __SCN = null, __SCNP = null;
  function loadScanner() {
    if (typeof Html5Qrcode !== 'undefined') return Promise.resolve(Html5Qrcode);
    if (__SCNP) return __SCNP;
    var srcs = [
      'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
      'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
    ];
    __SCNP = new Promise(function (resolve, reject) {
      (function tryLoad(i) {
        if (typeof Html5Qrcode !== 'undefined') return resolve(Html5Qrcode);
        if (i >= srcs.length) { __SCNP = null; return reject(new Error('โหลดตัวสแกนไม่สำเร็จ')); }
        var s = document.createElement('script');
        s.src = srcs[i]; s.async = true;
        s.onload = function () { typeof Html5Qrcode !== 'undefined' ? resolve(Html5Qrcode) : tryLoad(i + 1); };
        s.onerror = function () { tryLoad(i + 1); };
        document.head.appendChild(s);
      })(0);
    });
    return __SCNP;
  }
  function openCam(onCode) {
    var elemId = 'ci-qr-' + Date.now();
    Modal.open({
      title: '📷 สแกน QR บัตรสมาชิก', titleIcon: 'bi-qr-code-scan',
      html: '<div id="' + elemId + '" style="width:100%;aspect-ratio:1;background:#0f172a;border-radius:14px;overflow:hidden;max-width:380px;margin:0 auto"></div>'
        + '<div class="text-xs muted mt-2 text-center">หันกล้องไปที่ QR Code บนบัตร</div>',
      footer: '<button class="btn" data-modal-close type="button">ปิด</button>',
      onOpen: function (host) {
        loadScanner().then(function (HQ) {
          if (!document.getElementById(elemId)) return;
          var qr = new HQ(elemId);
          __SCN = qr;
          qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } },
            function (text) {
              try { qr.stop().then(function () { qr.clear(); }).catch(function () {}); } catch (e) {}
              __SCN = null;
              Modal.close();
              onCode(text);
            }, function () {}
          ).catch(function (e) {
            var el = document.getElementById(elemId);
            if (el) el.innerHTML = '<div style="color:#fca5a5;padding:36px;text-align:center"><i class="bi bi-camera-video-off" style="font-size:36px"></i><br>เปิดกล้องไม่ได้<br><span style="font-size:11px">' + esc(e.message || '') + '</span></div>';
          });
        }).catch(function () {
          var el = document.getElementById(elemId);
          if (el) el.innerHTML = '<div style="color:#fca5a5;padding:36px;text-align:center">โหลดตัวสแกนไม่สำเร็จ — พิมพ์รหัสแทนได้</div>';
        });
      }
    });
    var host = $('#modal-host');
    var oc = host._cleanup;
    host._cleanup = function () {
      if (__SCN) { try { __SCN.stop().then(function () { __SCN.clear(); }).catch(function () {}); } catch (e) {} __SCN = null; }
      if (oc) oc();
    };
  }

  // สแกนกล้องแบบ overlay — ใช้ซ้อนบน Modal อื่นได้ (เช่น modal ยืมหนังสือ)
  window.SLS_openCamOverlay = function (onCode) {
    var old = document.getElementById('sls-cam-overlay');
    if (old) old.remove();
    var elemId = 'cam-ov-' + Date.now();
    var ov = document.createElement('div');
    ov.id = 'sls-cam-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.85);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px';
    ov.innerHTML = '<div style="width:100%;max-width:400px;background:#fff;border-radius:18px;padding:16px;font-family:Kanit,sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.4)">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      +   '<b style="font-size:15px;color:#1e293b"><i class="bi bi-qr-code-scan" style="color:#6366f1"></i> สแกนบัตรนักเรียน</b>'
      +   '<button type="button" id="cam-ov-close" style="border:0;background:#f1f5f9;width:34px;height:34px;border-radius:9px;cursor:pointer;font-size:14px"><i class="bi bi-x-lg"></i></button>'
      + '</div>'
      + '<div id="' + elemId + '" style="width:100%;aspect-ratio:1;background:#0f172a;border-radius:12px;overflow:hidden"></div>'
      + '<div style="font-size:11px;color:#64748b;text-align:center;margin-top:8px">หันกล้องไปที่ QR Code บนบัตรสมาชิก</div>'
      + '</div>';
    document.body.appendChild(ov);
    var scanner = null;
    function cleanup() {
      if (scanner) { try { scanner.stop().then(function () { scanner.clear(); }).catch(function () {}); } catch (e) {} scanner = null; }
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    ov.querySelector('#cam-ov-close').addEventListener('click', cleanup);
    ov.addEventListener('click', function (e) { if (e.target === ov) cleanup(); });
    loadScanner().then(function (HQ) {
      if (!document.getElementById(elemId)) return;
      scanner = new HQ(elemId);
      scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } },
        function (text) { var cb = onCode; cleanup(); if (cb) cb(text); },
        function () {}
      ).catch(function (e) {
        var el = document.getElementById(elemId);
        if (el) el.innerHTML = '<div style="color:#fca5a5;padding:36px;text-align:center"><i class="bi bi-camera-video-off" style="font-size:32px"></i><br>เปิดกล้องไม่ได้<br><span style="font-size:11px">' + esc(e.message || '') + '</span></div>';
      });
    }).catch(function () {
      var el = document.getElementById(elemId);
      if (el) el.innerHTML = '<div style="color:#fca5a5;padding:36px;text-align:center">โหลดตัวสแกนไม่สำเร็จ — พิมพ์รหัสในช่องแทนได้</div>';
    });
  };

  // ═════════════════════════════════════════════════════════
  //  หน้าเช็คชื่อ (สำหรับบรรณารักษ์)
  // ═════════════════════════════════════════════════════════
  Routes['#/checkin'] = function () {
    if (!H.hasCap('checkin.manage|loan.manage')) { toast('คุณไม่มีสิทธิ์', 'warning'); location.hash = '#/dashboard'; return; }
    var hero = H.heroHtml({
      icon: 'bi-person-check-fill', pill: 'เช็คชื่อเข้าใช้',
      title: 'เช็คชื่อเข้าใช้ห้องสมุด',
      sub: 'สแกนบัตรสมาชิก · พิมพ์เลขประจำตัว/username · ดูสถิติวันนี้',
      grad: 'linear-gradient(135deg,#10b981 0%,#059669 55%,#14b8a6 100%)'
    });
    var scanBox = '<div class="sd-panel">'
      + '<div class="bw-scan-row" style="display:grid;grid-template-columns:auto 1fr auto;gap:8px">'
      +   '<button class="bw-scan-btn" id="ci-cam" type="button" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0 14px;min-width:64px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:0;border-radius:14px;font-family:inherit;font-weight:700;font-size:11px;cursor:pointer"><i class="bi bi-qr-code-scan" style="font-size:22px"></i><span>สแกน</span></button>'
      +   '<input class="input" id="ci-code" placeholder="เลขประจำตัว / username / สแกนบัตร แล้วกด Enter" autocomplete="off" style="height:56px;font-size:16px;font-weight:600">'
      +   '<button class="btn btn-success" id="ci-go" style="min-width:64px;height:56px;font-size:20px"><i class="bi bi-check-lg"></i></button>'
      + '</div>'
      + '<div id="ci-result"></div>'
      + '</div>';
    var kioskBox = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-display"></i> โหมดคีออส (ให้นักเรียนเช็คชื่อเอง)</div>'
      + '<div class="text-xs muted mb-2">เปิดลิงก์นี้ค้างไว้บนแท็บเล็ต/คอมหน้าห้องสมุด — ใช้เช็คชื่อได้อย่างเดียว ไม่ต้องล็อกอิน ทำอย่างอื่นไม่ได้</div>'
      + '<div class="flex gap-2" style="flex-wrap:wrap"><input class="input" id="ci-kiosk-url" readonly value="กำลังโหลด..." style="flex:1;min-width:200px;font-size:12px">'
      + '<button class="btn" id="ci-kiosk-copy"><i class="bi bi-clipboard"></i> คัดลอก</button>'
      + '<button class="btn btn-primary" id="ci-kiosk-open"><i class="bi bi-box-arrow-up-right"></i> เปิด</button></div>'
      + '</div>';
    var statsBox = '<div id="ci-stats" class="sd-stagger"></div>';
    var listBox = '<div class="sd-panel"><div class="sd-panel-title"><i class="bi bi-clock-history"></i> รายชื่อผู้เข้าใช้วันนี้ <span id="ci-count" class="badge b-active" style="margin-left:6px"></span></div><div id="ci-list">' + H.skBlock(80) + '</div></div>';

    H.pageWrap(hero + scanBox + statsBox + '<div class="sd-grid-2">' + kioskBox + '</div>' + listBox);

    var input = $('#ci-code');
    function submit() {
      var code = input.value.trim();
      if (!code) return;
      input.value = '';
      doCheckin(code);
    }
    $('#ci-go').addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    $('#ci-cam').addEventListener('click', function () { openCam(function (code) { input.value = code; submit(); }); });
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 150);

    // ลิงก์คีออส
    window.call('checkin.kiosk_info', {}).then(function (r) {
      var url = location.origin + location.pathname + '#/kiosk?key=' + r.key;
      var el = $('#ci-kiosk-url'); if (el) el.value = url;
      var cp = $('#ci-kiosk-copy'); if (cp) cp.addEventListener('click', function () {
        try { navigator.clipboard.writeText(url); toast('คัดลอกแล้ว', 'success'); }
        catch (e) { el.select(); document.execCommand('copy'); toast('คัดลอกแล้ว', 'success'); }
      });
      var op = $('#ci-kiosk-open'); if (op) op.addEventListener('click', function () { window.open(url, '_blank'); });
    }).catch(function (e) {
      var el = $('#ci-kiosk-url'); if (el) el.value = 'โหลดไม่สำเร็จ: ' + e.message;
    });

    loadToday();
  };

  function doCheckin(code) {
    Spinner.show('กำลังบันทึกการเข้าใช้');
    window.call('checkin.create', { code: code }).then(function (r) {
      Spinner.hide();
      beep(r.already ? 'dup' : 'success');
      var _u = r.user || {};
      speak(r.already ? 'เช็คชื่อไปแล้วครับ' : 'ยินดีต้อนรับ ' + (_u.full_name || ''));
      renderCheckinResult($('#ci-result'), r);
      loadToday();
      var input = $('#ci-code'); if (input) try { input.focus(); } catch (e) {}
    }).catch(function (e) {
      Spinner.hide();
      beep('error');
      speak('ไม่พบข้อมูลสมาชิก');
      var box = $('#ci-result');
      if (box) box.innerHTML = '<div style="margin-top:12px;padding:16px;background:linear-gradient(135deg,#fef2f2,#fff);border:1px solid #fecaca;border-radius:14px;display:flex;gap:12px;align-items:center">'
        + '<i class="bi bi-x-circle-fill" style="font-size:32px;color:#ef4444"></i>'
        + '<div><div class="font-bold" style="color:#991b1b">' + esc(e.message) + '</div><div class="text-xs muted">ตรวจสอบเลขประจำตัว/username แล้วลองใหม่</div></div></div>';
    });
  }

  function renderCheckinResult(box, r) {
    if (!box) return;
    var u = r.user || {};
    var isDup = !!r.already;
    box.innerHTML = '<div style="margin-top:12px;padding:16px;background:linear-gradient(135deg,' + (isDup ? '#fffbeb,#fff' : '#f0fdf4,#fff') + ');border:1px solid ' + (isDup ? '#fcd34d' : '#86efac') + ';border-radius:14px;display:flex;gap:14px;align-items:center;animation:bwSlideIn .25s ease">'
      + '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex-shrink:0;' + H.avatarStyle(u.avatar_url) + '">' + (u.avatar_url ? '' : esc(H.initials(u.full_name))) + '</div>'
      + '<div style="flex:1;min-width:0">'
      +   '<div class="font-bold" style="font-size:16px">' + esc(u.full_name || '-') + '</div>'
      +   '<div class="text-xs muted">' + esc(u.class_name || H.roleLabel(u.role)) + (u.student_no ? ' · ' + esc(u.student_no) : '') + '</div>'
      +   '<div class="text-xs mt-2" style="color:' + (isDup ? '#b45309' : '#047857') + ';font-weight:700">'
      +     (isDup
            ? '<i class="bi bi-info-circle-fill"></i> เช็คชื่อไปแล้วเมื่อ ' + esc(TH.time(r.checked_at))
            : '<i class="bi bi-check-circle-fill"></i> เช็คชื่อสำเร็จ ' + esc(TH.time(r.checked_at)) + ' · คนที่ ' + (r.today_count || 1) + ' ของวันนี้')
      +   '</div>'
      + '</div>'
      + '<i class="bi bi-' + (isDup ? 'exclamation-circle-fill' : 'check-circle-fill') + '" style="font-size:36px;color:' + (isDup ? '#f59e0b' : '#10b981') + '"></i>'
      + '</div>';
  }

  function loadToday() {
    window.call('checkin.list', { date: todayISO(), per_page: 300 }).then(function (data) {
      if (!$('#ci-list')) return;
      var items = data.items || [];
      var cnt = $('#ci-count'); if (cnt) cnt.textContent = items.length + ' คน';
      // สถิติ
      var byClass = {};
      items.forEach(function (it) { var c = it.class_name || 'อื่นๆ'; byClass[c] = (byClass[c] || 0) + 1; });
      var topClass = Object.keys(byClass).sort(function (a, b) { return byClass[b] - byClass[a]; })[0] || '-';
      var stats = $('#ci-stats');
      if (stats) stats.innerHTML =
        H.statCard({ label: 'เข้าใช้วันนี้', value: items.length, sub: TH.dateWeekday(new Date()), color: 'g-emerald', icon: 'bi-people-fill' })
        + H.statCard({ label: 'ห้องที่มามากสุด', value: topClass, sub: topClass !== '-' ? byClass[topClass] + ' คน' : '', color: 'g-indigo', icon: 'bi-mortarboard-fill' })
        + H.statCard({ label: 'ล่าสุด', value: items.length ? TH.time(items[0].checked_at) : '-', sub: items.length ? items[0].user_name : '', color: 'g-sky', icon: 'bi-clock-fill' });
      // ตาราง
      if (!items.length) {
        $('#ci-list').innerHTML = H.emptyState('ยังไม่มีผู้เข้าใช้วันนี้', 'bi-door-open');
        return;
      }
      $('#ci-list').innerHTML = '<div style="overflow-x:auto"><table class="data-table"><thead><tr><th>เวลา</th><th>ชื่อ</th><th>ห้อง</th><th>ช่องทาง</th></tr></thead><tbody>'
        + items.map(function (it) {
          return '<tr>'
            + '<td class="font-mono text-sm">' + esc(TH.time(it.checked_at)) + '</td>'
            + '<td><div class="flex gap-2 items-center"><div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;' + H.avatarStyle(it.avatar_url) + '">' + (it.avatar_url ? '' : esc(H.initials(it.user_name))) + '</div><div><div class="text-sm font-bold">' + esc(it.user_name) + '</div></div></div></td>'
            + '<td class="text-sm">' + esc(it.class_name || '-') + '</td>'
            + '<td>' + (it.source === 'kiosk' ? '<span class="badge b-active"><i class="bi bi-display"></i> คีออส</span>' : '<span class="badge b-borrowed"><i class="bi bi-person-badge"></i> เคาน์เตอร์</span>') + '</td>'
            + '</tr>';
        }).join('') + '</tbody></table></div>';
    }).catch(function (e) {
      var el = $('#ci-list'); if (el) el.innerHTML = H.emptyState(e.message, 'bi-exclamation-triangle');
    });
  }

  // ═════════════════════════════════════════════════════════
  //  หน้าคีออส (นักเรียนเช็คชื่อเอง — ไม่ต้องล็อกอิน)
  // ═════════════════════════════════════════════════════════
  var __KIOSK_TIMER = null;
  window.SLS_renderKiosk = function () {
    var bl = document.getElementById('boot-loader'); if (bl) bl.hidden = true;
    var key = (location.hash.split('key=')[1] || '').split('&')[0];
    var app = (Store.boot && Store.boot.app) || {};
    var st = (Store.boot && Store.boot.settings) || {};
    var libName = st.library_name || app.name || 'ห้องสมุดโรงเรียน';
    document.title = 'เช็คชื่อ · ' + libName;

    var root = document.getElementById('app-root');
    root.innerHTML = '<div style="min-height:100vh;background:linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#065f46 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;font-family:Kanit,sans-serif">'
      + '<div style="width:100%;max-width:560px;background:rgba(255,255,255,.06);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);border-radius:28px;padding:32px;text-align:center;color:#f1f5f9">'
      +   '<div style="width:72px;height:72px;margin:0 auto 12px;border-radius:22px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;font-size:36px;color:#fff;box-shadow:0 14px 34px rgba(16,185,129,.45)"><i class="bi bi-person-check-fill"></i></div>'
      +   '<div style="font-size:24px;font-weight:800">เช็คชื่อเข้าใช้ห้องสมุด</div>'
      +   '<div style="font-size:13px;color:rgba(241,245,249,.65);margin-bottom:6px">' + esc(libName) + '</div>'
      +   '<div id="kq-clock" style="font-size:13px;color:#6ee7b7;font-variant-numeric:tabular-nums;margin-bottom:18px">--:--:--</div>'
      +   '<div style="display:grid;grid-template-columns:auto 1fr;gap:8px;margin-bottom:8px">'
      +     '<button id="kq-cam" type="button" style="min-width:64px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:0;border-radius:16px;font-size:24px;cursor:pointer;box-shadow:0 8px 20px rgba(99,102,241,.4)"><i class="bi bi-qr-code-scan"></i></button>'
      +     '<input id="kq-code" placeholder="สแกนบัตร หรือกดเลขประจำตัว" autocomplete="off" inputmode="numeric" style="height:64px;border-radius:16px;border:2px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:#fff;font-size:20px;font-weight:700;text-align:center;outline:none;font-family:inherit">'
      +   '</div>'
      +   '<button id="kq-go" type="button" style="width:100%;height:58px;border:0;border-radius:16px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-family:inherit;font-size:18px;font-weight:800;cursor:pointer;box-shadow:0 10px 26px rgba(16,185,129,.42)"><i class="bi bi-check-circle-fill"></i> เช็คชื่อ</button>'
      +   '<div id="kq-result" style="margin-top:16px"></div>'
      + '</div>'
      + '<div style="margin-top:14px;font-size:11px;color:rgba(241,245,249,.4)">' + esc(app.name || 'SLS') + ' v' + esc(app.version || '') + '</div>'
      + '</div>';

    // นาฬิกา
    if (__KIOSK_TIMER) clearInterval(__KIOSK_TIMER);
    function tick() {
      var el = document.getElementById('kq-clock');
      if (!el) { clearInterval(__KIOSK_TIMER); return; }
      var d = new Date();
      el.textContent = TH.dateLongWeekday(d) + ' · ' + TH.timeFull(d);
    }
    tick();
    __KIOSK_TIMER = setInterval(tick, 1000);

    var input = document.getElementById('kq-code');
    var resBox = document.getElementById('kq-result');
    var busy = false;

    function showResult(html) {
      resBox.innerHTML = html;
      setTimeout(function () { if (resBox) resBox.innerHTML = ''; try { input.focus(); } catch (e) {} }, 4500);
    }
    function submit() {
      var code = input.value.trim();
      if (!code || busy) return;
      input.value = '';
      busy = true;
      resBox.innerHTML = '<div style="padding:14px;color:#6ee7b7"><i class="bi bi-hourglass-split"></i> กำลังบันทึก...</div>';
      window.call('checkin.kiosk', { key: key, code: code }).then(function (r) {
        busy = false;
        var u = r.user || {};
        beep(r.already ? 'dup' : 'success');
        speak(r.already ? 'เช็คชื่อไปแล้วครับ' : 'ยินดีต้อนรับ ' + (u.full_name || ''));
        if (r.already) {
          showResult('<div style="padding:18px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);border-radius:16px">'
            + '<div style="font-size:20px;font-weight:800;color:#fcd34d"><i class="bi bi-info-circle-fill"></i> เช็คชื่อไปแล้ว</div>'
            + '<div style="font-size:16px;margin-top:6px">' + esc(u.full_name) + ' · ' + esc(u.class_name || '') + '</div>'
            + '<div style="font-size:13px;color:rgba(241,245,249,.7)">เมื่อ ' + esc(TH.time(r.checked_at)) + '</div></div>');
        } else {
          showResult('<div style="padding:18px;background:rgba(16,185,129,.16);border:1px solid rgba(16,185,129,.45);border-radius:16px">'
            + '<div style="font-size:22px;font-weight:800;color:#6ee7b7"><i class="bi bi-check-circle-fill"></i> ยินดีต้อนรับ!</div>'
            + '<div style="font-size:18px;font-weight:700;margin-top:6px">' + esc(u.full_name) + '</div>'
            + '<div style="font-size:13px;color:rgba(241,245,249,.75)">' + esc(u.class_name || '') + ' · ' + esc(TH.time(r.checked_at)) + ' · คนที่ ' + (r.today_count || 1) + ' ของวันนี้</div></div>');
        }
      }).catch(function (e) {
        busy = false;
        beep('error');
        speak('ไม่พบข้อมูลสมาชิก กรุณาลองใหม่');
        showResult('<div style="padding:18px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.45);border-radius:16px">'
          + '<div style="font-size:18px;font-weight:800;color:#fca5a5"><i class="bi bi-x-circle-fill"></i> ' + esc(e.message) + '</div>'
          + '<div style="font-size:12px;color:rgba(241,245,249,.6);margin-top:4px">ลองใหม่ หรือติดต่อบรรณารักษ์</div></div>');
      });
    }
    document.getElementById('kq-go').addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    document.getElementById('kq-cam').addEventListener('click', function () {
      openCam(function (code) { input.value = code; submit(); });
    });
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 200);
  };

  // ═════════════════════════════════════════════════════════
  //  บัตรห้องสมุด (Canvas → PNG)
  // ═════════════════════════════════════════════════════════
  function qrURL(data, size) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&margin=6&data=' + encodeURIComponent(data);
  }
  function loadImg(url) {
    return new Promise(function (res) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = url;
    });
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // วาดรูปแบบ cover-fit (ครอบเต็มกรอบ ตัดขอบเกินตรงกลาง)
  function drawCover_(ctx, img, x, y, w, h) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var scale = Math.max(w / iw, h / ih);
    var sw = w / scale, sh = h / scale;
    var sx = (iw - sw) / 2, sy = (ih - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  // วาดบัตร 1 ใบ (ฐาน 1011×638 px = 8.56×5.4 ซม. @300dpi, s = อัตราย่อ) — มีรูปนักเรียน
  function drawCard(ctx, ox, oy, s, u, qrImg, avImg) {
    var st = (Store.boot && Store.boot.settings) || {};
    var app = (Store.boot && Store.boot.app) || {};
    var lib = st.library_name || app.name || 'ห้องสมุดโรงเรียน';
    var org = st.org_name || app.org || '';
    var W = 1011 * s, Hh = 638 * s;
    ctx.save();
    // ตัวบัตร
    rr(ctx, ox, oy, W, Hh, 26 * s);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = Math.max(1, 2 * s); ctx.stroke();
    ctx.clip();
    // แถบหัว
    var grad = ctx.createLinearGradient(ox, oy, ox + W, oy);
    grad.addColorStop(0, '#6366f1'); grad.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = grad;
    ctx.fillRect(ox, oy, W, 132 * s);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var libFs = 40;
    ctx.font = '700 ' + (libFs * s) + 'px Kanit, sans-serif';
    while (ctx.measureText(lib).width > W - 80 * s && libFs > 22) { libFs -= 2; ctx.font = '700 ' + (libFs * s) + 'px Kanit, sans-serif'; }
    ctx.fillText(lib, ox + 44 * s, oy + 60 * s);
    ctx.globalAlpha = 0.92;
    ctx.font = '400 ' + (23 * s) + 'px Kanit, sans-serif';
    ctx.fillText('บัตรสมาชิกห้องสมุด' + (org ? ' · ' + org : ''), ox + 44 * s, oy + 100 * s);
    ctx.globalAlpha = 1;
    // ── รูปนักเรียน (ซ้าย) ──
    var pw = 200 * s, ph = 250 * s, px = ox + 44 * s, py = oy + 168 * s;
    ctx.save();
    rr(ctx, px, py, pw, ph, 16 * s);
    ctx.fillStyle = '#eef2ff'; ctx.fill();
    ctx.clip();
    var drewPhoto = false;
    if (avImg) {
      try { drawCover_(ctx, avImg, px, py, pw, ph); drewPhoto = true; } catch (e) {}
    }
    if (!drewPhoto) {
      var g2 = ctx.createLinearGradient(px, py, px + pw, py + ph);
      g2.addColorStop(0, '#818cf8'); g2.addColorStop(1, '#a78bfa');
      ctx.fillStyle = g2; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 ' + (72 * s) + 'px Kanit, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(H.initials(u.full_name), px + pw / 2, py + ph / 2 - 14 * s);
      ctx.font = '500 ' + (20 * s) + 'px Kanit, sans-serif';
      ctx.globalAlpha = 0.85;
      ctx.fillText('ไม่มีรูป', px + pw / 2, py + ph / 2 + 50 * s);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    rr(ctx, px, py, pw, ph, 16 * s);
    ctx.strokeStyle = '#c7d2fe'; ctx.lineWidth = Math.max(1, 3 * s); ctx.stroke();
    // ── QR (ขวา) ──
    var q = 264 * s;
    var qx = ox + W - q - 48 * s, qy = oy + 172 * s;
    rr(ctx, qx - 14 * s, qy - 14 * s, q + 28 * s, q + 28 * s, 14 * s);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = Math.max(1, 2 * s); ctx.stroke();
    if (qrImg) ctx.drawImage(qrImg, qx, qy, q, q);
    else {
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(qx, qy, q, q);
      ctx.fillStyle = '#94a3b8'; ctx.font = '600 ' + (20 * s) + 'px Kanit, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('QR ไม่พร้อม', qx + q / 2, qy + q / 2); ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '700 ' + (20 * s) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(u.username || '', qx + q / 2, qy + q + 38 * s);
    ctx.textAlign = 'left';
    // ── ชื่อ (กลาง ระหว่างรูปกับ QR) ──
    var nameX = px + pw + 30 * s;
    var maxW = (qx - 16 * s) - 20 * s - nameX;
    var fs = 46;
    ctx.font = '700 ' + (fs * s) + 'px Kanit, sans-serif';
    while (ctx.measureText(u.full_name || '').width > maxW && fs > 22) { fs -= 2; ctx.font = '700 ' + (fs * s) + 'px Kanit, sans-serif'; }
    ctx.fillStyle = '#0f172a';
    ctx.fillText(u.full_name || '-', nameX, oy + 248 * s);
    // ห้อง / เลขประจำตัว (2 บรรทัดถ้ายาว)
    ctx.font = '500 ' + (27 * s) + 'px Kanit, sans-serif';
    ctx.fillStyle = '#475569';
    var l2a = u.class_name ? 'ชั้น ' + u.class_name : H.roleLabel(u.role);
    var l2b = u.student_no ? 'เลขประจำตัว ' + u.student_no : '';
    if (l2b && ctx.measureText(l2a + '  ·  ' + l2b).width <= maxW) {
      ctx.fillText(l2a + '  ·  ' + l2b, nameX, oy + 306 * s);
    } else {
      ctx.fillText(l2a, nameX, oy + 302 * s);
      if (l2b) ctx.fillText(l2b, nameX, oy + 344 * s);
    }
    // บทบาท
    ctx.font = '400 ' + (22 * s) + 'px Kanit, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(H.roleLabel(u.role) || '', nameX, oy + 392 * s);
    // เส้น + ท้ายบัตร
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath(); ctx.moveTo(ox + 44 * s, oy + Hh - 78 * s); ctx.lineTo(ox + W - 44 * s, oy + Hh - 78 * s); ctx.stroke();
    ctx.font = '400 ' + (22 * s) + 'px Kanit, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('สแกน QR เพื่อเช็คชื่อเข้าใช้และยืม-คืนหนังสือ', ox + 44 * s, oy + Hh - 34 * s);
    ctx.restore();
  }
  function fontsReady() {
    return (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(function () {}) : Promise.resolve();
  }

  // ── บัตรรายคน ──
  window.SLS_openCardModal = function (u) {
    if (!u) return;
    Modal.open({
      title: 'บัตรห้องสมุด · ' + u.full_name,
      titleIcon: 'bi-person-badge-fill',
      large: true,
      html: '<div style="text-align:center">'
        + '<canvas id="cd-cv" width="1011" height="638" style="width:100%;max-width:480px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18)"></canvas>'
        + '<div class="text-xs muted mt-2">ขนาดมาตรฐานบัตร 8.56 × 5.4 ซม. (300dpi) — ปริ้นแล้วเคลือบ/ตัดได้เลย</div>'
        + '</div>',
      footer: '<button class="btn" data-modal-close type="button">ปิด</button>'
        + '<button class="btn btn-primary" id="cd-dl" type="button"><i class="bi bi-download"></i> ดาวน์โหลด PNG</button>',
      onOpen: function (host) {
        var cv = host.querySelector('#cd-cv');
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 1011, 638);
        ctx.fillStyle = '#94a3b8'; ctx.font = '600 28px Kanit, sans-serif';
        ctx.textAlign = 'center'; ctx.fillText('กำลังสร้างบัตร...', 505, 330); ctx.textAlign = 'left';
        Promise.all([
          loadImg(qrURL('SLS:U:' + u.username, 300)),
          u.avatar_url ? loadImg(u.avatar_url) : Promise.resolve(null),
          fontsReady()
        ]).then(function (r) {
          ctx.clearRect(0, 0, 1011, 638);
          drawCard(ctx, 0, 0, 1, u, r[0], r[1]);
          host.querySelector('#cd-dl').onclick = function () {
            try {
              var a = document.createElement('a');
              a.download = 'card_' + (u.username || 'user') + '.png';
              a.href = cv.toDataURL('image/png');
              a.click();
            } catch (e) { toast('ดาวน์โหลดไม่สำเร็จ: ' + e.message, 'error'); }
          };
        });
      }
    });
  };

  // ── บัตรทั้งชุด (A4 หน้าละ 8 ใบ) ──
  window.SLS_openCardSheet = function () {
    Spinner.show('กำลังโหลดรายชื่อ');
    window.call('user.list', { active_only: true }).then(function (data) {
      Spinner.hide();
      var users = data.items || [];
      var classes = {};
      users.forEach(function (u) { if (u.class_name) classes[u.class_name] = 1; });
      var clsOpts = '<option value="">ทุกห้อง</option>' + Object.keys(classes).sort(function (a, b) { return a.localeCompare(b, 'th'); }).map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
      }).join('');
      Modal.open({
        title: 'พิมพ์บัตรห้องสมุด (ทั้งชุด)',
        titleIcon: 'bi-printer-fill',
        large: true,
        html: '<div class="flex gap-2 mb-3" style="flex-wrap:wrap;align-items:flex-end">'
          + '<div class="field" style="margin:0;flex:1;min-width:140px"><label>บทบาท</label><select class="select" id="cs-role">'
          +   '<option value="student" selected>นักเรียน</option><option value="teacher">ครู</option><option value="">ทั้งหมด</option></select></div>'
          + '<div class="field" style="margin:0;flex:1;min-width:140px"><label>ห้อง</label><select class="select" id="cs-class">' + clsOpts + '</select></div>'
          + '<button class="btn btn-primary" id="cs-gen" style="height:44px"><i class="bi bi-magic"></i> สร้างบัตร</button>'
          + '</div>'
          + '<div class="text-xs muted mb-2">กระดาษ A4 แนวตั้ง หน้าละ 8 ใบ — ปริ้นแบบ "ขนาดจริง 100%" แล้วตัดตามกรอบ</div>'
          + '<div id="cs-pages"></div>',
        footer: '<button class="btn" data-modal-close type="button">ปิด</button>',
        onOpen: function (host) {
          host.querySelector('#cs-gen').addEventListener('click', function () {
            var role = host.querySelector('#cs-role').value;
            var cls = host.querySelector('#cs-class').value;
            var picked = users.filter(function (u) {
              if (role && u.role !== role) return false;
              if (cls && u.class_name !== cls) return false;
              return true;
            }).sort(function (a, b) { return String(a.student_no || a.username).localeCompare(String(b.student_no || b.username), 'th'); });
            if (!picked.length) { toast('ไม่พบสมาชิกตามเงื่อนไข', 'warning'); return; }
            if (picked.length > 200) { toast('เกิน 200 คน — เลือกทีละห้องจะเร็วกว่า', 'warning'); return; }

            var pagesBox = host.querySelector('#cs-pages');
            pagesBox.innerHTML = '<div class="text-center muted text-sm" style="padding:20px"><i class="bi bi-hourglass-split"></i> กำลังสร้างบัตร ' + picked.length + ' ใบ (โหลด QR + รูปนักเรียน)...</div>';
            Spinner.show('กำลังสร้างบัตร ' + picked.length + ' ใบ', { stages: ['โหลด QR Code', 'วาดบัตร', 'จัดหน้า A4'] });

            Promise.all([fontsReady()].concat(picked.map(function (u) {
              return Promise.all([
                loadImg(qrURL('SLS:U:' + u.username, 300)),
                u.avatar_url ? loadImg(u.avatar_url) : Promise.resolve(null)
              ]);
            }))).then(function (results) {
              var imgs = results.slice(1);
              var perPage = 8, cols = 2;
              var s = 570 / 1011;
              var cw = 1011 * s, ch = 638 * s;
              var PW = 1240, PH = 1754;
              var gx = 24, gy = 26;
              var mx = (PW - cols * cw - gx) / 2, my = 64;
              var totalPages = Math.ceil(picked.length / perPage);
              pagesBox.innerHTML = '';

              var dlAllBar = document.createElement('div');
              dlAllBar.className = 'flex justify-end mb-3';
              dlAllBar.innerHTML = '<button class="btn btn-success" id="cs-dl-all"><i class="bi bi-download"></i> ดาวน์โหลดทุกหน้า (' + totalPages + ' ไฟล์)</button>';
              pagesBox.appendChild(dlAllBar);

              var canvases = [];
              for (var p = 0; p < totalPages; p++) {
                var cv = document.createElement('canvas');
                cv.width = PW; cv.height = PH;
                cv.style.cssText = 'width:100%;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.08);margin-bottom:8px';
                var ctx = cv.getContext('2d');
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, PW, PH);
                ctx.fillStyle = '#94a3b8'; ctx.font = '600 20px Kanit, sans-serif';
                ctx.fillText('บัตรสมาชิกห้องสมุด' + (cls ? ' · ' + cls : '') + '  —  หน้า ' + (p + 1) + '/' + totalPages + '  (' + picked.length + ' ใบ)', 44, 40);
                for (var i = 0; i < perPage; i++) {
                  var idx = p * perPage + i;
                  if (idx >= picked.length) break;
                  var col = i % cols, row = Math.floor(i / cols);
                  drawCard(ctx, mx + col * (cw + gx), my + row * (ch + gy), s, picked[idx], imgs[idx][0], imgs[idx][1]);
                }
                canvases.push(cv);
                var wrap = document.createElement('div');
                wrap.style.marginBottom = '14px';
                wrap.appendChild(cv);
                var btn = document.createElement('button');
                btn.className = 'btn btn-sm';
                btn.innerHTML = '<i class="bi bi-download"></i> ดาวน์โหลดหน้า ' + (p + 1);
                (function (canvas, pageNo) {
                  btn.addEventListener('click', function () {
                    try {
                      var a = document.createElement('a');
                      a.download = 'library_cards_' + (cls || role || 'all') + '_p' + pageNo + '.png';
                      a.href = canvas.toDataURL('image/png');
                      a.click();
                    } catch (e) { toast('ดาวน์โหลดไม่สำเร็จ: ' + e.message, 'error'); }
                  });
                })(cv, p + 1);
                wrap.appendChild(btn);
                pagesBox.appendChild(wrap);
              }
              var dlAll = dlAllBar.querySelector('#cs-dl-all');
              dlAll.addEventListener('click', function () {
                canvases.forEach(function (canvas, i) {
                  setTimeout(function () {
                    try {
                      var a = document.createElement('a');
                      a.download = 'library_cards_' + (cls || role || 'all') + '_p' + (i + 1) + '.png';
                      a.href = canvas.toDataURL('image/png');
                      a.click();
                    } catch (e) {}
                  }, i * 600);
                });
                toast('กำลังดาวน์โหลด ' + canvases.length + ' ไฟล์', 'info');
              });
              Spinner.hide();
              toast('สร้างบัตรเรียบร้อย ' + picked.length + ' ใบ', 'success');
            }).catch(function (e) {
              Spinner.hide();
              toast('สร้างบัตรไม่สำเร็จ: ' + (e && e.message || e), 'error');
            });
          });
        }
      });
    }).catch(function (e) { Spinner.hide(); toast(e.message, 'error'); });
  };
})();
