// Projecção composta da Península Ibérica: um mapa principal e caixas para Açores, Madeira e Canárias.
// Cada feature traz properties.frame ("main", "acores", "madeira", "canarias") e é desenhada pela projecção do seu frame.
// Cada frame é uma cónica conforme centrada na sua zona e ajustada ao seu rectângulo.
window.iberiaProjection = function iberiaProjection(features, layout) {
  const frames = layout.map(({ name, extent }) => {
    const fc = { type: 'FeatureCollection', features: features.filter(f => f.properties.frame === name) };
    const [[lon0, lat0], [lon1, lat1]] = d3.geoBounds(fc);
    const projection = d3.geoConicConformal()
      .rotate([-(lon0 + lon1) / 2, 0])
      .parallels([lat0 + (lat1 - lat0) / 4, lat1 - (lat1 - lat0) / 4])
      .fitExtent(extent, fc);
    return {
      name,
      extent,
      projection,
      path: d3.geoPath(projection),
      geoBounds: [[lon0 - 1, lat0 - 1], [lon1 + 1, lat1 + 1]],
    };
  });
  const byName = Object.fromEntries(frames.map(f => [f.name, f]));
  const main = byName.main;
  const insets = frames.filter(f => f !== main);
  const inside = ([x, y], [[x0, y0], [x1, y1]]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

  return {
    frames,
    insets,
    path: f => byName[f.properties.frame].path(f),
    bounds(features) {
      let b = [[Infinity, Infinity], [-Infinity, -Infinity]];
      for (const f of features) {
        const [[x0, y0], [x1, y1]] = byName[f.properties.frame].path.bounds(f);
        b = [[Math.min(b[0][0], x0), Math.min(b[0][1], y0)], [Math.max(b[1][0], x1), Math.max(b[1][1], y1)]];
      }
      return b;
    },
    // [lon, lat] → [x, y], no frame cuja zona geográfica contém o ponto
    project(lonLat) {
      const frame = insets.find(f => inside(lonLat, f.geoBounds)) || main;
      return frame.projection(lonLat);
    },
    // [x, y] → [lon, lat], no frame cujo rectângulo contém o ponto
    invert(xy) {
      const frame = insets.find(f => inside(xy, f.extent)) || main;
      return frame.projection.invert(xy);
    },
  };
};
