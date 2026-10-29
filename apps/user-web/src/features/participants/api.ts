import { apiJson } from '../../lib/api';

export interface ParticipantProfile { id:string; displayName:string }

export async function loadParticipantProfile():Promise<ParticipantProfile>{
  const profile=await apiJson('/user/profile');
  return {id:String(profile.id||''),displayName:String(profile.displayName||'')};
}
export async function saveParticipantName(displayName:string):Promise<ParticipantProfile>{return await apiJson('/user/profile',{method:'PUT',body:JSON.stringify({displayName})}) as unknown as ParticipantProfile;}
