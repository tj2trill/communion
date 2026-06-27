# External Asset Sources

The app uses small, checked-in public visualization assets so it can run offline after installation.

## Globe Textures

- `public/textures/earth_atmos_2048.jpg`
- `public/textures/earth_clouds_1024.png`
- `public/textures/earth_lights_2048.png`
- `public/textures/earth_normal_2048.jpg`
- `public/textures/earth_specular_2048.jpg`

Source: Three.js examples planet textures, retrievable from `https://threejs.org/examples/textures/planets/`.

## Natural Earth GeoJSON

- `src/data/ne_50m_land.json`
- `src/data/ne_50m_countries.json`
- `src/data/ne_110m_land.json`
- `src/data/ne_110m_countries.json`
- `src/data/ne_110m_populated_places.json`

Source: Natural Earth Vector GeoJSON mirror at `https://github.com/nvkelso/natural-earth-vector`.

These files support the globe surface, real land/country context, country-boundary overlays, and real populated-place markers. The simulated AI nations remain fictional and bounded to the Communion state machine.

## Human Delegate Model

- `public/models/Xbot.glb`

Source: Three.js GLTF example model at `https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf`.

The model is cloned per delegate and animated locally; no runtime asset download is required.
