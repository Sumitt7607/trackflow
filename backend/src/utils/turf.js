const { point, polygon, lineString } = require('@turf/helpers');
const distance = require('@turf/distance').default || require('@turf/distance');
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default || require('@turf/boolean-point-in-polygon');
const pointToLineDistance = require('@turf/point-to-line-distance').default || require('@turf/point-to-line-distance');

module.exports = {
  point,
  polygon,
  lineString,
  distance,
  booleanPointInPolygon,
  pointToLineDistance,
};
