/* ==========================================================================
   AlbA Convoyages — Interactions & animations (vanilla JS, sans dépendance)
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIGURATION DES FORMULAIRES
     Renseignez une URL d'envoi (Formspree, Make, Zapier, API maison…)
     pour recevoir les demandes directement. Laissé vide, le formulaire
     ouvre le client e-mail du visiteur avec un message pré-rempli.
     ------------------------------------------------------------------ */
  const FORM_ENDPOINT = '';
  const CONTACT_EMAIL = 'administratif@albaconvoyages.fr';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICONS = document.documentElement.dataset.icons || 'assets/img/icons.svg';
  const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="${ICONS}#${id}"/></svg>`;

  /* ---------- Header : état au scroll + masquage intelligent ---------- */
  const header = $('.site-header');
  let mobileBar = $('.mobile-bar');
  // Sur la page devis, le formulaire et la carte contact suffisent.
  if (mobileBar && /devis\.html$/.test(location.pathname)) { mobileBar.remove(); mobileBar = null; }
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    if (header) {
      header.classList.toggle('is-scrolled', y > 24);
      const goingDown = y > lastY && y > 480;
      header.classList.toggle('is-hidden', goingDown && !document.body.classList.contains('menu-open'));
    }
    if (mobileBar) mobileBar.classList.toggle('is-visible', y > window.innerHeight * 0.6);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Menu mobile ---------- */
  const burger = $('.burger');
  const menu = $('#mobile-menu');
  if (burger && menu) {
    const setMenu = (open) => {
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      if (open) { menu.hidden = false; requestAnimationFrame(() => $('a', menu)?.focus({ preventScroll: true })); }
      else setTimeout(() => { if (!document.body.classList.contains('menu-open')) menu.hidden = true; }, 700);
    };
    burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); burger.focus(); } });
  }

  /* ---------- Titres : révélation mot par mot ---------- */
  $$('[data-split]').forEach((el) => {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const mask = document.createElement('span');
            mask.className = 'line-mask';
            mask.style.display = 'inline-block';
            const inner = document.createElement('span');
            inner.className = 'line-inner';
            inner.style.setProperty('--i', i++);
            inner.textContent = part;
            mask.appendChild(inner);
            frag.appendChild(mask);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
    $$('.line-mask', el).forEach((m) => m.setAttribute('aria-hidden', 'true'));
  });

  /* ---------- Révélations au scroll ---------- */
  const revealEls = $$('[data-reveal], [data-split]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Texte « statement » qui se colore au scroll ---------- */
  $$('[data-statement]').forEach((el) => {
    const words = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.textContent = part;
            words.push(w);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(el);
    if (reduceMotion) { words.forEach((w) => w.classList.add('is-on')); return; }
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const lit = Math.round(progress * words.length);
      words.forEach((w, idx) => w.classList.toggle('is-on', idx < lit));
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------- Compteurs animés ---------- */
  const counters = $$('[data-count]');
  if (counters.length) {
    const format = (n, dec) => n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split('.')[1] || '').length;
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      if (reduceMotion) { el.textContent = prefix + format(target, dec) + suffix; return; }
      const dur = 1800;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = prefix + format(target * eased, dec) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.5 });
    counters.forEach((c) => io.observe(c));
  }

  /* ---------- Marquees : duplication du contenu pour une boucle continue ---------- */
  $$('.marquee').forEach((m) => {
    const track = $('.marquee__track', m);
    if (!track) return;
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    $$('a, button', clone).forEach((n) => n.setAttribute('tabindex', '-1'));
    m.appendChild(clone);
  });

  /* ---------- Carrousels (scroll-snap + flèches) ---------- */
  $$('[data-slider]').forEach((slider) => {
    const track = $('.slider__track', slider);
    const prev = $('[data-prev]', slider);
    const next = $('[data-next]', slider);
    if (!track) return;
    const step = () => (track.firstElementChild?.getBoundingClientRect().width || 300) + 16;
    const sync = () => {
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });

  /* ---------- Liste d'audiences (onglets avec visuel) ---------- */
  $$('[data-audience]').forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const imgs = $$('.audience__visual img', root);
    const caption = $('[data-audience-caption]', root);
    let current = 0;
    let timer;
    const select = (idx, focus = false) => {
      current = idx;
      tabs.forEach((t, i) => {
        t.setAttribute('aria-selected', String(i === idx));
        t.tabIndex = i === idx ? 0 : -1;
      });
      imgs.forEach((img, i) => img.classList.toggle('is-active', i === idx));
      if (caption) caption.innerHTML = `<small>${tabs[idx].dataset.label}</small>${tabs[idx].dataset.caption}`;
      if (focus) tabs[idx].focus();
    };
    const auto = () => { clearInterval(timer); if (!reduceMotion) timer = setInterval(() => select((current + 1) % tabs.length), 4500); };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { select(i); auto(); });
      t.addEventListener('mouseenter', () => { select(i); clearInterval(timer); });
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
    root.addEventListener('mouseleave', auto);
    select(0);
    auto();
  });

  /* ---------- Process : étape active dans la navigation sticky ---------- */
  $$('[data-process]').forEach((root) => {
    const links = $$('.process__nav a', root);
    const steps = $$('.step', root);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const id = e.target.id;
          links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + id));
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    steps.forEach((s) => io.observe(s));
  });

  /* ---------- Accordéons (FAQ) ---------- */
  $$('.accordion').forEach((acc) => {
    const btn = $('.accordion__btn', acc);
    btn?.addEventListener('click', () => {
      const open = !acc.classList.contains('is-open');
      const group = acc.closest('[data-accordion-group]');
      if (open && group) $$('.accordion.is-open', group).forEach((o) => { o.classList.remove('is-open'); $('.accordion__btn', o).setAttribute('aria-expanded', 'false'); });
      acc.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Vidéos YouTube (chargées uniquement au clic) ---------- */
  const openVideo = (id, title) => {
    const modal = document.createElement('div');
    modal.className = 'video-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title || 'Vidéo');
    modal.innerHTML = `<div class="video-modal__frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1" title="${title || 'Vidéo'}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><button class="video-modal__close" type="button" aria-label="Fermer la vidéo">${icon('x')}</button>`;
    const prevFocus = document.activeElement;
    const close = () => { modal.classList.remove('is-open'); setTimeout(() => modal.remove(), 350); document.removeEventListener('keydown', onKey); prevFocus?.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.video-modal__close')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(modal);
    requestAnimationFrame(() => { modal.classList.add('is-open'); $('.video-modal__close', modal).focus(); });
  };
  $$('[data-video]').forEach((btn) => btn.addEventListener('click', (e) => { e.preventDefault(); openVideo(btn.dataset.video, btn.dataset.videoTitle); }));

  /* ---------- Parallaxe légère ---------- */
  const parallax = $$('[data-parallax]');
  if (parallax.length && !reduceMotion) {
    const update = () => {
      const vh = window.innerHeight;
      parallax.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const speed = parseFloat(el.dataset.parallax) || 0.1;
        const offset = (r.top + r.height / 2 - vh / 2) * speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.12)`;
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------- Éligibilité convoyeur ---------- */
  $$('[data-eligibility]').forEach((root) => {
    const boxes = $$('input[type="checkbox"]', root);
    const result = $('.elig-result', root);
    const count = $('[data-elig-count]', root);
    const msg = $('[data-elig-msg]', root);
    const sync = () => {
      const n = boxes.filter((b) => b.checked).length;
      const ok = n === boxes.length;
      result.classList.toggle('is-ok', ok);
      if (count) count.textContent = `${n} / ${boxes.length}`;
      if (msg) msg.textContent = ok ? 'Votre profil correspond, déposez votre candidature.' : 'Les trois conditions doivent être remplies pour candidater.';
    };
    boxes.forEach((b) => b.addEventListener('change', sync));
    sync();
  });

  /* ---------- Champs fichiers ---------- */
  $$('.file-drop').forEach((drop) => {
    const input = $('input[type="file"]', drop);
    const label = $('[data-file-label]', drop);
    if (!input) return;
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.add('is-drag')));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-drag')));
    input.addEventListener('change', () => {
      const f = input.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { label.textContent = 'Fichier trop lourd (2 Mo max.)'; input.value = ''; return; }
      label.textContent = f.name;
    });
  });

  /* ---------- Formulaires : validation, étapes, envoi ---------- */
  const validateField = (field) => {
    const inputs = $$('input, select, textarea', field);
    let valid = true;
    inputs.forEach((input) => {
      if (input.type === 'radio') {
        if (input.required && !$$(`input[name="${input.name}"]`, field).some((r) => r.checked)) valid = false;
      } else if (!input.checkValidity()) valid = false;
    });
    field.classList.toggle('is-invalid', !valid);
    return valid;
  };
  const validateScope = (scope) => {
    const fields = $$('.field, .checkbox-field', scope).filter((f) => $$('[required]', f).length);
    let firstInvalid = null;
    fields.forEach((f) => { if (!validateField(f) && !firstInvalid) firstInvalid = f; });
    if (firstInvalid) $('input, select, textarea', firstInvalid)?.focus();
    return !firstInvalid;
  };

  $$('form[data-form]').forEach((form) => {
    const steps = $$('.form-step', form);
    const indicators = $$('.form-steps__item', form);
    let stepIdx = 0;
    const showStep = (i) => {
      stepIdx = i;
      steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
      indicators.forEach((ind, k) => {
        ind.classList.toggle('is-active', k === i);
        ind.classList.toggle('is-done', k < i);
        if (k === i) ind.setAttribute('aria-current', 'step'); else ind.removeAttribute('aria-current');
      });
      const top = form.getBoundingClientRect().top + window.scrollY - 120;
      if (window.scrollY > top) window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      $('input, select, textarea', steps[i])?.focus({ preventScroll: true });
    };
    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-next-step]')) { e.preventDefault(); if (validateScope(steps[stepIdx])) showStep(stepIdx + 1); }
      if (e.target.closest('[data-prev-step]')) { e.preventDefault(); showStep(stepIdx - 1); }
    });
    form.addEventListener('input', (e) => { const f = e.target.closest('.field, .checkbox-field'); if (f?.classList.contains('is-invalid')) validateField(f); });
    form.addEventListener('change', (e) => { const f = e.target.closest('.field, .checkbox-field'); if (f?.classList.contains('is-invalid')) validateField(f); });
    if (steps.length) showStep(0);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateScope(steps.length ? steps[stepIdx] : form)) return;
      if ($('[name="_gotcha"]', form)?.value) return; // anti-spam
      const submit = $('[type="submit"]', form);
      const success = $('.form-success', form.parentElement);
      const data = new FormData(form);
      const subject = form.dataset.subject || 'Demande depuis le site';
      submit?.setAttribute('disabled', '');
      try {
        if (FORM_ENDPOINT) {
          data.append('_subject', subject);
          const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error('Envoi impossible');
        } else {
          const lines = [];
          for (const [k, v] of data.entries()) {
            if (k.startsWith('_') || v instanceof File) continue;
            const label = form.querySelector(`[name="${k}"]`)?.dataset.label || k;
            lines.push(`${label} : ${v}`);
          }
          if ($$('input[type="file"]', form).some((f) => f.files.length)) lines.push('', '(Pensez à joindre vos documents à ce message.)');
          const cc = form.dataset.cc ? `&cc=${encodeURIComponent(form.dataset.cc)}` : '';
          window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}${cc}&body=${encodeURIComponent('Bonjour,\n\n' + lines.join('\n') + '\n\nMerci.')}`;
        }
        form.hidden = true;
        success?.classList.add('is-visible');
        success?.setAttribute('tabindex', '-1');
        success?.focus();
      } catch (err) {
        alert(`L'envoi n'a pas pu aboutir. Vous pouvez nous écrire à ${CONTACT_EMAIL} ou nous appeler au 07 89 62 17 61.`);
      } finally {
        submit?.removeAttribute('disabled');
      }
    });
  });

  /* ---------- Date minimale des champs date ---------- */
  const today = new Date().toISOString().split('T')[0];
  $$('input[type="date"][data-min-today]').forEach((i) => { i.min = today; });

  /* ---------- Année du footer ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
