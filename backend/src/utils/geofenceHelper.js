const turf = require('./turf');

/**
 * Format custom LatLng coords from DB to turf-compatible [lng, lat] array
 * Turf requires polygon to be closed (first and last coordinate must be identical).
 */
const formatPolygonForTurf = (dbCoords) => {
  if (!dbCoords || dbCoords.length < 3) return [];
  const coords = dbCoords.map((pt) => [pt.lng, pt.lat]);
  
  // Ensure the polygon is closed
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]]);
  }
  return coords;
};

/**
 * Check if a point is inside a polygon geofence
 * @param {Object} point { lat, lng }
 * @param {Array} dbPolygonCoords Array of { lat, lng }
 */
const isInsidePolygon = (point, dbPolygonCoords) => {
  try {
    const turfPoint = turf.point([point.lng, point.lat]);
    const turfPolyCoords = formatPolygonForTurf(dbPolygonCoords);
    if (turfPolyCoords.length < 4) return false; // Needs at least 4 points to close a polygon
    const turfPolygon = turf.polygon([turfPolyCoords]);
    return turf.booleanPointInPolygon(turfPoint, turfPolygon);
  } catch (error) {
    console.error('Error in polygon geofence calculation:', error);
    return false;
  }
};

/**
 * Check if a point is inside a circle geofence
 * @param {Object} point { lat, lng }
 * @param {Object} center { lat, lng }
 * @param {Number} radiusInMeters
 */
const isInsideCircle = (point, center, radiusInMeters) => {
  try {
    const from = turf.point([point.lng, point.lat]);
    const to = turf.point([center.lng, center.lat]);
    const distanceInMeters = turf.distance(from, to, { units: 'meters' });
    return distanceInMeters <= radiusInMeters;
  } catch (error) {
    console.error('Error in circle geofence calculation:', error);
    return false;
  }
};

/**
 * Check if an employee coordinate lies within a geofence model
 * @param {Object} point { lat, lng }
 * @param {Object} geofence Geofence document
 */
const checkGeofence = (point, geofence) => {
  if (geofence.type === 'circle') {
    return isInsideCircle(point, geofence.circleCenter, geofence.radius);
  } else if (geofence.type === 'polygon') {
    return isInsidePolygon(point, geofence.polygonCoordinates);
  }
  return false;
};

/**
 * Calculate distance between two coordinates in kilometers
 * @param {Object} pt1 { lat, lng }
 * @param {Object} pt2 { lat, lng }
 */
const getDistance = (pt1, pt2) => {
  try {
    const from = turf.point([pt1.lng, pt1.lat]);
    const to = turf.point([pt2.lng, pt2.lat]);
    return turf.distance(from, to, { units: 'kilometers' });
  } catch (error) {
    return 0;
  }
};

/**
 * Check if a point deviates from a route
 * @param {Object} currentPoint { lat, lng }
 * @param {Array} waypoints Array of { lat, lng }
 * @param {Number} thresholdKm Deviation threshold in km (default 0.5km)
 */
const checkRouteDeviation = (currentPoint, waypoints, thresholdKm = 0.5) => {
  if (!waypoints || waypoints.length === 0) return false;
  try {
    if (waypoints.length === 1) {
      const dist = getDistance(currentPoint, waypoints[0]);
      return dist > thresholdKm;
    }

    const coords = waypoints.map(wp => [wp.lng, wp.lat]);
    const line = turf.lineString(coords);
    const pt = turf.point([currentPoint.lng, currentPoint.lat]);
    const distanceToLine = turf.pointToLineDistance(pt, line, { units: 'kilometers' });

    return distanceToLine > thresholdKm;
  } catch (error) {
    console.error('Error in route deviation calculation:', error);
    // Fallback: check distance to nearest waypoint
    let minDistance = Infinity;
    for (const wp of waypoints) {
      const dist = getDistance(currentPoint, wp);
      if (dist < minDistance) minDistance = dist;
    }
    return minDistance > thresholdKm;
  }
};

module.exports = {
  isInsidePolygon,
  isInsideCircle,
  checkGeofence,
  getDistance,
  checkRouteDeviation,
};
