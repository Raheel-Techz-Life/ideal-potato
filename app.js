/* HAAZRI landing: phone simulator + step sync. No dependencies. */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- screens shown on the phone's LCD (static strings only, so innerHTML is safe) ----
  const TRADES = { 1: 'Mason', 2: 'Mixer operator', 3: 'Loader' };
  const FLOW = {
    idle:  { t: 'Missed call', l: ['Hubli, KA', '2s ago', '', 'Press Start to call back'], soft: 'Start', on: { start: 'lang' } },
    lang:  { t: 'नमस्ते', l: ['1 हिंदी', '2 ಕನ್ನಡ', '3 English'], soft: 'Pick 1-3', on: { 1: 'trade', 2: 'trade', 3: 'trade' } },
    trade: { t: 'Your trade?', l: ['1 Mason', '2 Mixer operator', '3 Loader'], soft: 'Pick 1-3', on: { 1: 'name', 2: 'name', 3: 'name' } },
    name:  { t: 'Say your name', l: ['Listening'], wave: true, soft: '', auto: [2400, 'saved'] },
    saved: { t: 'Profile saved', l: ['Job ID HZ-9921', 'Job alerts on'], soft: '', auto: [1900, 'job'] },
    job:   { t: 'SMS: new job', l: (s) => [s.trade + ', Dharwad', '₹900/day, 6 days', '1 Apply'], soft: 'Press 1', on: { 1: 'pitch' } },
    pitch: { t: '30s voice pitch', l: ['Recording'], wave: true, soft: '', auto: [2800, 'done'] },
    done:  { t: 'Applied', l: ['Employer is reviewing', 'Site alert 7:00 AM', 'tomorrow'], soft: 'Start again', on: { start: 'lang' } },
    // previews used by the "How it works" phone
    wage:  { t: 'Wage floor', l: ['Min ₹800/day', '1 Urgent work: on'], soft: 'Set' },
    alert: { t: 'Night-before alert', l: ['Site: Dharwad', '₹900/day', 'Bring helmet'], soft: '7:00 AM' },
    hist:  { t: 'Work history', l: ['12 jobs done', 'Rating 4.8', 'Job ID HZ-9921'], soft: 'Portable' }
  };

  // ---- DTMF tones (real dual-tone frequencies), created lazily on first tap ----
  const TONES = {
    1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477],
    7: [852, 1209], 8: [852, 1336], 9: [852, 1477], '*': [941, 1209], 0: [941, 1336], '#': [941, 1477],
    start: [523], stop: [330]
  };
  let ctx = null;
  let soundOn = true;
  function beep(key) {
    if (!soundOn || !TONES[key]) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      g.connect(ctx.destination);
      TONES[key].forEach((f) => {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        o.connect(g);
        o.start(t);
        o.stop(t + 0.12);
      });
    } catch (e) { /* audio is optional */ }
  }

  // ---- phone ----
  function Phone(root, interactive) {
    const screen = root.querySelector('[data-screen]');
    const soft = root.querySelector('[data-soft]');
    const state = { trade: 'Mason' };
    let cur = 'idle';
    let timer = 0;

    function show(id, isStatic) {
      clearTimeout(timer);
      cur = id;
      if (!isStatic && root._log) root._log('system', id);
      const s = FLOW[id];
      const lines = typeof s.l === 'function' ? s.l(state) : s.l;
      screen.innerHTML =
        '<p class="h">' + s.t + '</p>' +
        lines.map((x) => '<p>' + (x || '&nbsp;') + '</p>').join('') +
        (s.wave ? '<div class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' : '');
      soft.textContent = s.soft || '';
      if (!isStatic && s.auto) timer = setTimeout(() => show(s.auto[1]), s.auto[0]);
    }

    function press(key) {
      beep(key);
      if (!interactive) return;
      if (root._log) root._log('worker', 'key ' + key);
      root.querySelectorAll('.pulse').forEach((b) => b.classList.remove('pulse'));
      if (key === 'stop') return show('idle');
      const next = FLOW[cur].on && FLOW[cur].on[key];
      if (!next) return;
      if (cur === 'trade') state.trade = TRADES[key];
      show(next);
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-key]');
      if (b) press(b.dataset.key);
    });

    show('idle');
    return { show, root };
  }

  // mobile menu
  const mb = document.querySelector('.menu-btn'), nv = document.querySelector('.nav');
  if (mb && nv) mb.addEventListener('click', () => {
    const o = nv.classList.toggle('open');
    mb.setAttribute('aria-expanded', String(o));
  });

  const heroEl = document.querySelector('[data-phone]:not([data-static])');
  const hiwEl = document.querySelector('[data-phone][data-static]');
  if (!heroEl && !hiwEl) return;

  // optional event log (simulator page)
  const logEl = document.querySelector('[data-log]');
  const NOTE = { idle: 'Waiting for missed call', lang: 'Bhashini TTS: language menu', trade: 'DTMF collected, ask trade', name: 'ASR capturing name', saved: 'Profile written, ID issued', job: 'SMS sent with job offer', pitch: 'ASR capturing voice pitch', done: 'Application sent to employer' };
  if (logEl) heroEl._log = (who, what) => {
    const e = logEl.querySelector('.empty'); if (e) e.remove();
    const li = document.createElement('li');
    if (who === 'worker') li.className = 'u';
    const t = new Date().toLocaleTimeString('en-GB');
    li.innerHTML = '<span>' + t + '</span><b>' + who + '</b><span>' + (who === 'system' ? (NOTE[what] || what) : what) + '</span>';
    logEl.appendChild(li);
  };

  if (heroEl) Phone(heroEl, true);
  const hiw = hiwEl ? Phone(hiwEl, false) : null;

  // one orchestrated moment: the phone rings once on load
  if (!reduced && heroEl) {
    heroEl.classList.add('ring');
    heroEl.querySelector('.phone-body').addEventListener('animationend', () => heroEl.classList.remove('ring'), { once: true });
  }

  // sound toggle (both phones' captions share one setting)
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-sound]');
    if (!t) return;
    soundOn = !soundOn;
    document.querySelectorAll('[data-sound]').forEach((b) => {
      b.textContent = soundOn ? 'Sound on' : 'Sound off';
      b.setAttribute('aria-pressed', String(soundOn));
    });
  });

  // "How it works": the pinned phone follows whichever step is centred
  if (hiw && 'IntersectionObserver' in window) {
    const steps = document.querySelectorAll('.steps li');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        steps.forEach((s) => s.classList.toggle('on', s === en.target));
        hiw.show(en.target.dataset.screen, true);
      });
    }, { rootMargin: '-42% 0px -42% 0px' });
    steps.forEach((s) => io.observe(s));
    hiw.show('name', true); // sensible state before the first step is reached
  } else if (hiw) {
    document.querySelectorAll('.steps li').forEach((s) => s.classList.add('on'));
  }
})();

// contact form -> mailto draft
document.querySelectorAll('form[data-mailto]').forEach((f) => f.addEventListener('submit', (e) => {
  e.preventDefault();
  const d = new FormData(f);
  const body = 'Name: ' + d.get('name') + '\nOrganisation: ' + d.get('org') + '\nRole: ' + d.get('role') + '\n\n' + d.get('msg');
  location.href = 'mailto:' + f.dataset.mailto + '?subject=' + encodeURIComponent('HAAZRI pilot enquiry') + '&body=' + encodeURIComponent(body);
}));
