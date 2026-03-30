// athlete.js - manual checkin flow
import { upsertManualGeocoding } from './common.js';

export async function handleManualCheckin(data){
  const { data: checkin } = await window.sb
    .from('checkins')
    .insert([data])
    .select()
    .single();

  if(checkin?.id){
    await upsertManualGeocoding(checkin.id, data);
  }
}
