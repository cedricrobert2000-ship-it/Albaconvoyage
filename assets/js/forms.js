/* ==========================================================================
   AlbA Convoyages — Champs intelligents des formulaires
   1. Mise en forme automatique : plaque (AB-123-CD), téléphone, noms
   2. Validation avec messages clairs : plaque, date, téléphone, e-mail
      (+ suggestion de correction pour les fautes de frappe d'e-mail)
   3. Autocomplétion (API publiques et gratuites de l'État, sans clé) :
      - communes      : geo.api.gouv.fr
      - adresses      : api-adresse.data.gouv.fr (Base Adresse Nationale)
      - entreprises   : recherche-entreprises.api.gouv.fr (pré-remplit l'adresse
                        de facturation et le SIRET)
   Les champs restent utilisables à la main si une API ne répond pas.
   ========================================================================== */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- 1. Mise en forme ---------- */
  const formatters = {
    // Plaque SIV : AB-123-CD, tirets ajoutés pendant la saisie.
    // Ancien format (1234 AB 56) et numéro de série (17 caractères) acceptés tels quels.
    plaque(value, inserting) {
      const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const siv = raw.match(/^([A-Z]{1,2})(\d{0,3})([A-Z]{0,2})$/);
      if (siv && raw.length <= 7) {
        const [, a, b, c] = siv;
        let out = a;
        if (b || (inserting && a.length === 2)) out += '-' + b;
        if (c || (inserting && b.length === 3)) out += '-' + c;
        return out;
      }
      return value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 17);
    },
    tel(value) {
      const intl = value.trim().startsWith('+');
      let d = value.replace(/\D/g, '');
      if (intl) {
        d = d.slice(0, 11);
        return '+' + d.slice(0, 2) + (d.length > 2 ? ' ' + d.slice(2, 3) : '') + (d.length > 3 ? ' ' + d.slice(3).match(/.{1,2}/g).join(' ') : '');
      }
      return d.slice(0, 10).match(/.{1,2}/g)?.join(' ') || '';
    },
    nom(value) {
      return value.replace(/(^|[\s'-])(\p{L})/gu, (m, sep, l) => sep + l.toUpperCase());
    },
  };

  /* ---------- 2. Règles de validation (message vide = valide) ---------- */
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const rules = {
    plaque(v) {
      if (/^[A-Z]{2}-\d{3}-[A-Z]{2}$/.test(v)) return '';
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return '';                // numéro de série (VIN)
      if (/^\d{1,4} ?[A-Z]{1,3} ?(\d{2}|2A|2B)$/.test(v)) return '';  // ancien format FNI
      if (/^[A-Z]{1,2}(-\d{0,3})?(-[A-Z]{0,2})?$/.test(v)) return 'Plaque incomplète : format attendu AB-123-CD.';
      return 'Format attendu : AB-123-CD (ou numéro de série à 17 caractères pour un véhicule neuf).';
    },
    date(v, input) {
      if (input.validity.badInput) return 'Date incomplète ou invalide.';
      const d = new Date(v + 'T00:00:00');
      if (Number.isNaN(d.getTime())) return 'Date invalide.';
      const t = today();
      if (d < t) return 'La date ne peut pas être dans le passé.';
      const max = new Date(t); max.setFullYear(max.getFullYear() + 1);
      if (d > max) return 'Choisissez une date dans les 12 prochains mois.';
      return '';
    },
    tel(v) {
      const d = v.replace(/\D/g, '');
      if (/^0[1-9]\d{8}$/.test(d) || /^33[1-9]\d{8}$/.test(d)) return '';
      return 'Numéro attendu : 06 12 34 56 78 (10 chiffres).';
    },
    email(v) {
      return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v) ? '' : 'Adresse e-mail invalide (exemple : nom@societe.fr).';
    },
  };
  const kindOf = (input) => input.dataset.format || (['tel', 'email', 'date'].includes(input.type) ? input.type : '');

  // Appelée par main.js avant chaque vérification d'un champ
  window.albaValidate = (input) => {
    const rule = rules[kindOf(input)];
    let msg = '';
    if (rule && (input.value || input.validity.badInput)) msg = rule(input.value.trim(), input);
    input.setCustomValidity(msg);
    const err = input.closest('.field, .qq-field')?.querySelector('.field__error');
    if (err) {
      if (!err.dataset.default) err.dataset.default = err.textContent;
      err.textContent = msg || err.dataset.default;
    }
    return msg;
  };

  // Suggestion de correction pour les domaines d'e-mail mal saisis
  const DOMAINS = ['gmail.com', 'hotmail.fr', 'hotmail.com', 'outlook.fr', 'outlook.com', 'yahoo.fr', 'yahoo.com', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'icloud.com', 'live.fr', 'bbox.fr'];
  const distance = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return dp[a.length][b.length];
  };
  const suggestEmail = (input) => {
    const field = input.closest('.field');
    let box = field?.querySelector('.field__suggest');
    const [user, domain] = input.value.trim().toLowerCase().split('@');
    let best = '';
    if (user && domain && !DOMAINS.includes(domain)) {
      const scored = DOMAINS.map((d) => [d, distance(domain, d)]).sort((x, y) => x[1] - y[1]);
      if (scored[0][1] > 0 && scored[0][1] <= 2) best = `${user}@${scored[0][0]}`;
    }
    if (!field) return;
    if (!best) { box?.remove(); return; }
    if (!box) { box = document.createElement('p'); box.className = 'field__suggest'; field.appendChild(box); }
    box.innerHTML = 'Vouliez-vous dire <button type="button"></button> ?';
    const btn = box.querySelector('button');
    btn.textContent = best;
    btn.addEventListener('click', () => { input.value = best; box.remove(); window.albaValidate(input); input.focus(); });
  };

  // Branchement : mise en forme pendant la saisie, validation à la sortie du champ
  $$('input').forEach((input) => {
    const kind = kindOf(input);
    const fmt = formatters[input.dataset.format] || (input.type === 'tel' ? formatters.tel : null);
    if (fmt) {
      input.addEventListener('input', (e) => {
        if (input.dataset.format === 'nom') return;
        const inserting = !e.inputType || e.inputType.startsWith('insert');
        const next = fmt(input.value, inserting);
        if (next !== input.value) input.value = next;
      });
    }
    if (input.dataset.format === 'nom') input.addEventListener('blur', () => { input.value = formatters.nom(input.value); });
    if (!kind) return;
    input.addEventListener('blur', () => {
      if (!input.value && !input.validity.badInput) return;
      const field = input.closest('.field');
      const msg = window.albaValidate(input);
      field?.classList.toggle('is-invalid', !!msg);
      if (kind === 'email') suggestEmail(input);
    });
    input.addEventListener('input', () => {
      if (input.closest('.field')?.classList.contains('is-invalid')) {
        const msg = window.albaValidate(input);
        input.closest('.field').classList.toggle('is-invalid', !!msg);
      }
    });
  });

  /* ---------- 3. Autocomplétion ---------- */
  const titleCase = (s) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, sep, l) => sep + l.toUpperCase());
  const SOURCES = {
    commune: {
      url: (q) => `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,codesPostaux,departement&boost=population&limit=6`,
      map: (data) => data.map((c) => ({
        value: `${c.nom}${c.codesPostaux?.[0] ? ` (${c.codesPostaux[0]})` : ''}`,
        label: c.nom, sub: [c.codesPostaux?.[0], c.departement?.nom].filter(Boolean).join(' · '),
      })),
    },
    adresse: {
      url: (q) => `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`,
      map: (data) => (data.features || []).map((f) => ({ value: f.properties.label, label: f.properties.name, sub: `${f.properties.postcode || ''} ${f.properties.city || ''}`.trim() })),
    },
    entreprise: {
      url: (q) => `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=5`,
      map: (data) => (data.results || []).map((r) => ({
        value: r.nom_complet, label: r.nom_complet,
        sub: [r.siege?.libelle_commune, r.siren && `SIREN ${r.siren}`].filter(Boolean).join(' · '),
        adresse: r.siege?.adresse ? titleCase(r.siege.adresse) : '', siret: r.siege?.siret || '',
      })),
      // À la sélection : adresse de facturation et SIRET pré-remplis
      onSelect: (item, input) => {
        const form = input.form;
        const fact = form?.querySelector('[name="facturation"]');
        if (fact && !fact.value && item.adresse) { fact.value = item.adresse; window.albaValidate(fact); fact.closest('.field')?.classList.remove('is-invalid'); }
        const siret = form?.querySelector('[name="siret"]');
        if (siret) siret.value = item.siret;
      },
    },
  };

  let uid = 0;
  $$('input[data-autocomplete]').forEach((input) => {
    const source = SOURCES[input.dataset.autocomplete];
    if (!source) return;
    const id = `ac-${++uid}`;
    const wrap = document.createElement('div');
    wrap.className = 'ac';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const list = document.createElement('ul');
    list.className = 'ac__list';
    list.id = id;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    wrap.appendChild(list);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', id);
    input.setAttribute('autocomplete', 'off');

    let items = [];
    let active = -1;
    let timer;
    let controller;
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const setActive = (i) => {
      active = i;
      $$('[role="option"]', list).forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      if (i >= 0) { input.setAttribute('aria-activedescendant', `${id}-${i}`); list.children[i]?.scrollIntoView({ block: 'nearest' }); }
    };
    const choose = (i) => {
      const item = items[i];
      if (!item) return;
      input.value = item.value;
      close();
      source.onSelect?.(item, input);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.closest('.field')?.classList.remove('is-invalid');
    };
    const render = () => {
      list.innerHTML = '';
      items.forEach((item, i) => {
        const li = document.createElement('li');
        li.id = `${id}-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.innerHTML = '<span class="ac__label"></span><span class="ac__sub"></span>';
        li.firstChild.textContent = item.label;
        li.lastChild.textContent = item.sub || '';
        li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
        list.appendChild(li);
      });
      list.hidden = !items.length;
      input.setAttribute('aria-expanded', String(!!items.length));
      active = -1;
    };
    const search = (q) => {
      controller?.abort();
      controller = new AbortController();
      fetch(source.url(q), { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data) => { items = source.map(data); if (document.activeElement === input) render(); })
        .catch(() => {});
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { items = []; close(); return; }
      timer = setTimeout(() => search(q), 220);
    });
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((active - 1 + items.length) % items.length); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
  });

  /* ---------- 4. Widget de devis du hero : messages d'erreur dans le widget ---------- */
  $$('.quick-quote').forEach((form) => {
    form.noValidate = true;
    const messages = { depart: 'Indiquez la ville de départ.', arrivee: "Indiquez la ville d'arrivée.", vehicule: 'Choisissez un type de véhicule.' };
    const check = (el) => {
      const field = el.closest('.qq-field');
      let err = field.querySelector('.field__error');
      if (!err) { err = document.createElement('span'); err.className = 'field__error'; err.setAttribute('aria-live', 'polite'); field.appendChild(err); }
      const ok = el.checkValidity();
      err.textContent = ok ? '' : messages[el.name] || 'Champ requis.';
      field.classList.toggle('is-invalid', !ok);
      return ok;
    };
    form.addEventListener('submit', (e) => {
      const fields = $$('[required]', form);
      const invalid = fields.filter((el) => !check(el));
      if (invalid.length) { e.preventDefault(); invalid[0].focus(); }
    });
    $$('[required]', form).forEach((el) => el.addEventListener('change', () => { if (el.closest('.qq-field').classList.contains('is-invalid')) check(el); }));
    $$('[required]', form).forEach((el) => el.addEventListener('input', () => { if (el.closest('.qq-field').classList.contains('is-invalid')) check(el); }));
  });
})();
