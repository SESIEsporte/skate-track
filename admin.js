// admin.js - map rendering using geocoding
function getMarkerPosition(checkin, geocodingMap){
  if(checkin.latitude && checkin.longitude){
    return [checkin.latitude, checkin.longitude];
  }

  const geo = geocodingMap[checkin.id];
  if(geo?.geocoded_latitude && geo?.geocoded_longitude){
    return [geo.geocoded_latitude, geo.geocoded_longitude];
  }

  return null;
}

export function buildGeocodingMap(rows){
  const map = {};
  rows.forEach(r => map[r.checkin_id] = r);
  return map;
}
