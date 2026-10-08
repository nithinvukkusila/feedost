# design/ — design canvas working files

This folder is not application code. `design/project/` holds the source of the FeeDost design canvas (https://claude.ai/artifact/Hw29EoVQpkcfqCKL7xTq3H): one `.dc.html` file per screen plus `canvas.json`.

- Do not import anything from here into `src/`. Build screens from `docs/DESIGN.md` tokens and the components in `src/components/ui/`.
- You may read a `.dc.html` file to check a screen's exact layout, copy and sizes.
- Do not edit these files as part of an app task. Design changes are a separate request and are republished to the canvas.
- Exclude this folder from lint, type-check, tests and the build.
- `Dir-A-Bahi`, `Dir-B-Night` and `Dir-C-Loud` are the three direction boards kept as a record. Direction A was chosen; ignore B and C.
