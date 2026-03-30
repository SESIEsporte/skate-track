// common.js - geocode manual call
export async function upsertManualGeocoding(checkinId, payload){
  return await window.sb.functions.invoke('geocode-manual', {
    body: {
      checkinId,
      pais: payload.pais,
      estado: payload.estado,
      cidade: payload.cidade
    }
  });
}
