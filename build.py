#!/usr/bin/env python3
"""Génère les pages HTML du site à partir de _src/.

Usage :  python3 build.py

- _src/layout.html  : gabarit commun (head, header, menu mobile, footer)
- _src/pages/*.html : contenu de chaque page. La première ligne contient
  les métadonnées au format JSON dans un commentaire :
  <!--meta {"title": "...", "description": "...", "nav": "services"} -->

Les pages générées sont écrites à la racine du dépôt (prêtes à être
hébergées telles quelles). Aucune dépendance : Python 3 standard.
Des raccourcis sont disponibles dans les pages :
  {{icon:nom}}  -> icône du sprite assets/img/icons.svg
  {{arrow}}     -> tuile flèche des boutons
  {{stars}}     -> 5 étoiles
"""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "_src"
NAVS = ["accueil", "services", "convoyeur", "blog", "devis"]


def icon(name: str) -> str:
    return f'<svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#{name}"/></svg>'


ARROW = f'<span class="btn__tile">{icon("arrow-ur")}{icon("arrow-ur")}</span>'
STARS = '<span class="stars" aria-label="5 étoiles sur 5">' + "".join(
    '<svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#star"/></svg>' for _ in range(5)
) + "</span>"


def expand(html: str) -> str:
    html = html.replace("{{arrow}}", ARROW).replace("{{stars}}", STARS)
    return re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: icon(m.group(1)), html)


def asset_version() -> str:
    """Empreinte des CSS/JS/icônes : change dès qu'un fichier change,
    ce qui force les navigateurs à recharger la nouvelle version (cache busting)."""
    h = hashlib.sha1()
    for f in sorted([*ROOT.glob("assets/css/*.css"), *ROOT.glob("assets/js/*.js"), ROOT / "assets/img/icons.svg"]):
        h.update(f.read_bytes())
    return h.hexdigest()[:8]


def bust(html: str, version: str) -> str:
    return re.sub(r'((?:href|src)="assets/(?:css|js)/[\w.-]+\.(?:css|js))"', rf'\1?v={version}"', html) \
             .replace('assets/img/icons.svg#', f'assets/img/icons.svg?v={version}#')


def build() -> None:
    version = asset_version()
    layout = (SRC / "layout.html").read_text(encoding="utf-8")
    for page in sorted((SRC / "pages").glob("*.html")):
        raw = page.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--meta\s+(\{.*?\})\s*-->\s*", raw, re.S)
        if not m:
            raise SystemExit(f"Métadonnées manquantes dans {page.name}")
        meta = json.loads(m.group(1))
        content = expand(raw[m.end():])
        out = layout
        values = {
            "title": meta["title"],
            "description": meta["description"],
            "path": meta.get("path", "/" + ("" if page.stem == "index" else page.name)),
            "og_image": meta.get("og_image", "equipe-carla-fabrice.webp"),
            "head_extra": meta.get("head_extra", ""),
            "cta_title": meta.get("cta_title", "Prêt à nous confier vos convoyages ?"),
            "cta_text": meta.get("cta_text", "Décrivez-nous votre besoin. Carla ou Fabrice vous répond dans l'heure avec un devis adapté à votre activité."),
            "cta_btn": meta.get("cta_btn", "Demander un devis gratuit"),
            "cta_href": meta.get("cta_href", "devis.html"),
        }
        for nav in NAVS:
            values[f"nav_{nav}"] = ' aria-current="page"' if meta.get("nav") == nav else ""
        for key, val in values.items():
            out = out.replace("{{" + key + "}}", val)
        out = out.replace("{{content}}", content.rstrip())
        (ROOT / page.name).write_text(bust(out, version), encoding="utf-8")
        print(f"✓ {page.name}")


if __name__ == "__main__":
    build()
