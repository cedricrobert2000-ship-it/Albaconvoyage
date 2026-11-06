#!/usr/bin/env python3
"""Génère les pages HTML du site à partir de _src/.

Usage :  python3 build.py

- _src/layout.html  : gabarit commun (head, header, menu mobile, footer)
- _src/pages/*.html : contenu de chaque page. La première ligne contient
  les métadonnées au format JSON dans un commentaire :
  <!--meta {"title": "...", "description": "...", "nav": "services"} -->

Les pages générées sont écrites à la racine du dépôt (prêtes à être
hébergées telles quelles). Aucune dépendance : Python 3 standard.
Le build produit aussi :
  - assets/css/site.min.css : tokens.css + main.css, minifiés en un seul fichier
  - srcset automatique quand une variante « -700 » / « -600 » d'une image existe
  - sitemap.xml et robots.txt (pages marquées "noindex" exclues)
Des raccourcis sont disponibles dans les pages :
  {{icon:nom}}  -> icône du sprite assets/img/icons.svg
  {{arrow}}     -> tuile flèche des boutons
  {{stars}}     -> 5 étoiles
"""
import datetime
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "_src"
NAVS = ["accueil", "services", "convoyeur", "blog", "devis"]
SITE = "https://albaconvoyages.fr"
CSS_SOURCES = ["assets/css/tokens.css", "assets/css/main.css"]


def icon(name: str) -> str:
    return f'<svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#{name}"/></svg>'


ARROW = f'<span class="btn__tile">{icon("arrow-ur")}{icon("arrow-ur")}</span>'
STARS = '<span class="stars" aria-label="5 étoiles sur 5">' + "".join(
    '<svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#star"/></svg>' for _ in range(5)
) + "</span>"


def expand(html: str) -> str:
    html = html.replace("{{arrow}}", ARROW).replace("{{stars}}", STARS)
    return re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: icon(m.group(1)), html)


def minify_css(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)       # commentaires
    css = re.sub(r"\s+", " ", css)                          # espaces multiples
    css = re.sub(r"\s*([{};,>])\s*", r"\1", css)            # autour de la ponctuation
    css = re.sub(r":\s+", ":", css)
    return css.replace(";}", "}").strip()


def bundle_css() -> None:
    css = "\n".join((ROOT / f).read_text(encoding="utf-8") for f in CSS_SOURCES)
    (ROOT / "assets/css/site.min.css").write_text(minify_css(css), encoding="utf-8")


def responsive_images(html: str) -> str:
    """Ajoute srcset/sizes aux images qui ont une variante plus légère."""
    def repl(m: re.Match) -> str:
        tag, name = m.group(0), m.group(1)
        if "srcset=" in tag:
            return tag
        for w in (700, 600):
            if (ROOT / f"assets/img/{name}-{w}.webp").exists():
                full = re.search(r'width="(\d+)"', tag)
                fw = full.group(1) if full else "1400"
                extra = f' srcset="assets/img/{name}-{w}.webp {w}w, assets/img/{name}.webp {fw}w" sizes="(min-width: 1000px) 45vw, 92vw"'
                return tag.replace(f'src="assets/img/{name}.webp"', f'src="assets/img/{name}.webp"{extra}', 1)
        return tag
    return re.sub(r'<img[^>]*src="assets/img/([\w-]+)\.webp"[^>]*>', repl, html)


def write_seo_files(urls: list) -> None:
    today = datetime.date.today().isoformat()
    items = "".join(
        f"  <url><loc>{SITE}{u}</loc><lastmod>{today}</lastmod><priority>{'1.0' if u == '/' else '0.7'}</priority></url>\n"
        for u in urls
    )
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{items}</urlset>\n',
        encoding="utf-8")
    (ROOT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nDisallow: /design-system.html\n\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")


def asset_version() -> str:
    """Empreinte des CSS/JS/icônes : change dès qu'un fichier change,
    ce qui force les navigateurs à recharger la nouvelle version (cache busting)."""
    h = hashlib.sha1()
    for f in sorted([*map(ROOT.joinpath, CSS_SOURCES), *ROOT.glob("assets/js/*.js"), ROOT / "assets/img/icons.svg"]):
        h.update(f.read_bytes())
    return h.hexdigest()[:8]


def bust(html: str, version: str) -> str:
    return re.sub(r'((?:href|src)="assets/(?:css|js)/[\w.-]+\.(?:css|js))"', rf'\1?v={version}"', html) \
             .replace('assets/img/icons.svg#', f'assets/img/icons.svg?v={version}#')


def build() -> None:
    bundle_css()
    version = asset_version()
    urls = []
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
            "og_image": meta.get("og_image", "og-equipe.jpg"),
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
        (ROOT / page.name).write_text(bust(responsive_images(out), version), encoding="utf-8")
        if "noindex" not in meta.get("head_extra", ""):
            urls.append(values["path"])
        print(f"✓ {page.name}")
    write_seo_files(urls)
    print("✓ site.min.css, sitemap.xml, robots.txt")


if __name__ == "__main__":
    build()
