---
name: Appearance / Theme system
description: Architecture du système de thème et préférences utilisateur BrutePawa
---

## Rule
`AppearanceContext.tsx` est le seul endroit où les préférences (thème/couleur/fontSize) sont lues, écrites et appliquées au DOM.

## Table DB
`user_preferences` (migration `007_user_preferences.sql` appliquée) — colonnes: user_id (unique), theme, primary_color, font_size.

## API
`GET/PUT /api/preferences` — validation stricte whitelist serveur, requireAuth.

## DOM application
- `data-bp-theme="light|dark"` sur `document.documentElement`
- CSS vars sur `:root` style: `--bp-primary`, `--bp-primary-dark`, `--bp-font-base`
- CSS vars de thème dans `index.css` sous `[data-bp-theme="light|dark"]`: `--theme-bg/surface/text/text2/border/muted`

## Persistance
localStorage (`bp_appearance`) immédiat + sync API au "Enregistrer". Au montage: API écrase localStorage si serveur répond.

**Why:** les composants existants utilisent des couleurs hardcodées (px, hex), donc le dark mode global n'est pas encore complet — seule AppearancePage et les éléments utilisant les CSS vars bénéficient du theming.

## localStorage key
Token auth: `bp_token`. User data: `fb_user` (écrit par `saveFbUser`). Appearance: `bp_appearance`.
