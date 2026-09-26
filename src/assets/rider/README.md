# Rider asset slot (superseded)

The rider video now loads from `public/assets/avatar/rider.webm` (a
`public/` path, served at the site root, since it's fetched at runtime by
an HTML `<video>` element rather than bundled by Vite). Drop the final
clip there instead of in this folder -- see
`public/assets/avatar/README.md` and the comment block at the top of
`src/three/Rider.tsx`.

This `src/assets/rider/` folder is no longer used and can be removed.
