---
name: Appearance / Theme system
description: Architecture du système de thème et préférences utilisateur BrutePawa
---

## Rule
`AppearanceContext.tsx` est le seul endroit où les préférences (thème/couleur/fontSize) sont lues, écrites et appliquées au DOM. Il met à jour TOUTES les CSS vars (nouvelles + legacy) ET injecte un `<style id="bp-dark-override">` pour le mode sombre.

## Table DB
`user_preferences` (migration `007_user_preferences.sql` appliquée) — colonnes: user_id (unique), theme, primary_color, font_size.

## API
`GET/PUT /api/preferences` — validation stricte whitelist serveur, requireAuth.

## DOM application (applyToDOM)
Vars mises à jour sur `document.documentElement.style`:
- `--bp-primary`, `--bp-primary-dark`, `--bp-primary-rgb` (format: "R, G, B")
- `--bp-font-base` (13px / 15px / 17px)
- `--theme-bg/surface/text/text2/border/muted` (light/dark tokens)
- `--fb-blue/green/border/divider/bg/white/text/input/sheet/glass-header` (legacy vars)
- `html.style.fontSize = FONT_SCALE[fontSize]`
- `document.body.style.backgroundColor/color` en mode sombre
- `<style id="bp-dark-override">` injecté avec `!important` pour inputs, modals, etc.

## Propagation couleur principale dans les TSX
- Bulk sed: `#22C55E` → `var(--bp-primary)` dans ~1370 fichiers TSX
- Bulk sed: `#16A34A` → `var(--bp-primary-dark)`
- Cas alpha-hex `#22C55E20` → `rgba(var(--bp-primary-rgb),0.13)` (2 occurrences)
- SVG: sélecteurs CSS `[fill="#22C55E"] { fill: var(--bp-primary) !important; }` dans index.css
- rgba(34,197,94,...) → rgba(var(--bp-primary-rgb),...) dans index.css

## Propagation dark mode dans les TSX
- Bulk sed: `background: "#fff"` → `background: "var(--theme-surface)"` (431 occurrences)
- Bulk sed: `color: "#111827"` → `color: "var(--theme-text)"` (228 occurrences)

## Fichiers EXCLUS du bulk sed
- `AppearancePage.tsx` — contient les valeurs hex comme identifiants des swatches
- `AppearanceContext.tsx` — contient les listes de validation ALLOWED_COLORS

## Mobile app (Expo)
CSS vars ne fonctionnent pas en React Native. L'API `/api/preferences` est prête mais le mobile doit lire les prefs au démarrage et les injecter dans un ThemeContext RN — tâche séparée à créer.

## localStorage key
Token auth: `bp_token`. User data: `fb_user` (écrit par `saveFbUser`). Appearance: `bp_appearance`.

**Why:** tous les composants ayant des couleurs d'accentuation hardcodées en `#22C55E` ou `#16A34A` utilisent maintenant des CSS vars, donc un simple `document.documentElement.style.setProperty("--bp-primary", newColor)` suffit à changer la couleur sur toute la plateforme sans rechargement.
