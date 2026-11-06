# AlbA Convoyages — refonte du site

Nouveau site vitrine d'[albaconvoyages.fr](https://albaconvoyages.fr), avec une direction artistique inspirée de Sterling : bleu nuit, bleu électrique, fonds glacier et typographie serrée. Le site est **statique** (HTML, CSS et JS natifs, sans framework). Il est rapide, s'héberge n'importe où et est pensé d'abord pour le mobile.

## Pages

| Page | Fichier | Ancienne URL WordPress |
|---|---|---|
| Accueil | `index.html` | `/` |
| Nos services | `services.html` | `/nos-services/` |
| Devis & contact (+ FAQ) | `devis.html` | `/contact-devis-convoyage/` |
| Devenir convoyeur | `devenir-convoyeur.html` | `/devenir-convoyeur/` |
| Infos convoyage (blog) | `blog.html` | `/blog/` |
| Article : convoyage urgent | `convoyage-urgent-24-48h.html` | `/blog/livraison-vehicule-24-48-heures/` |
| Article : choisir son prestataire | `choisir-prestataire-convoyage.html` | `/blog/choisir-prestataire-convoyage-automobile/` |
| Mentions légales | `mentions-legales.html` | `/politique-de-confidentialite/` |

Lors de la mise en ligne, prévoir des **redirections 301** des anciennes URL vers les nouvelles, pour conserver le référencement.

## Structure

```
_src/
  layout.html        gabarit commun : <head>, header, menu mobile, footer
  pages/*.html       contenu de chaque page (source à modifier)
assets/
  css/tokens.css     design tokens : couleurs, typo, espacements, rayons, ombres, animations
  css/main.css       composants (boutons, cartes, hero, FAQ, formulaires…)
  js/main.js         animations et interactions (aucune dépendance)
  img/               images optimisées (WebP) + sprite d'icônes icons.svg
build.py             génère les pages HTML finales à la racine
*.html               pages générées, prêtes à être hébergées
```

## Modifier le site

1. Modifier le contenu dans `_src/pages/…` ou le gabarit commun dans `_src/layout.html`.
2. Régénérer les pages :
   ```bash
   python3 build.py
   ```
3. Prévisualiser :
   ```bash
   python3 -m http.server 8080
   ```
   Puis ouvrir http://localhost:8080. Il faut passer par un serveur local : ouvert directement en `file://`, le site n'affiche pas les icônes.

Raccourcis utilisables dans les pages : `{{icon:phone}}`, `{{arrow}}` (tuile flèche des boutons), `{{stars}}`.

## Design tokens

Toute la charte se trouve dans `assets/css/tokens.css` : changer une valeur la met à jour sur tout le site.

- **Couleurs** : `--navy-900` (#0e285d, sections sombres), `--electric-500` (#005eff, actions), `--ice-100` (#edf7ff, fonds clairs). Le bleu du logo (`--alba-blue`, #0077c0) est conservé.
- **Typographies** : *Mona Sans* pour les titres, *Golos Text* pour le texte (Google Fonts).
- **Échelle typographique fluide** (`--fs-*`), **espacements** (`--space-*`), **rayons** (`--radius-*`), **ombres** et **durées d'animation**.

## Formulaires (devis et candidature)

Dans `assets/js/main.js`, renseigner `FORM_ENDPOINT` avec l'URL d'un service d'envoi (Formspree, Make, Zapier ou une API) pour recevoir les demandes directement, pièces jointes comprises.

Tant que ce champ est vide, l'envoi ouvre la messagerie du visiteur avec un e-mail pré-rempli adressé à `administratif@albaconvoyages.fr`. Dans ce mode, les fichiers (KBIS, RC Circulation) ne sont pas joints automatiquement.

## Animations et accessibilité

- Titres révélés mot par mot, texte « statement » qui se colore au scroll, apparitions au scroll, compteurs animés, bandeaux défilants, parallaxe légère, header qui se floute et se masque au scroll.
- Respect de `prefers-reduced-motion` : les animations sont coupées si le système le demande.
- Navigation au clavier, lien d'évitement, `aria` sur le menu, la FAQ et les onglets, contrastes AA.
- Mobile : menu plein écran, barre d'action fixe (Appeler / Devis), cibles tactiles de 44 px minimum, carrousels en scroll-snap.
- Vidéos YouTube chargées uniquement au clic, en mode sans cookie (`youtube-nocookie`).
- SEO : balises meta et Open Graph, données structurées `LocalBusiness` et `FAQPage`.
