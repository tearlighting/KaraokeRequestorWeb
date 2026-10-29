import { createUseReactiveStore } from '../../../../packages/reactiveStore';
import type { ParticipantProfile } from '../features/participants/api';

type ParticipantState={profile:ParticipantProfile|null;loading:boolean;saving:boolean;error:string};
export const useParticipantStore=createUseReactiveStore<ParticipantState>(()=>({profile:null,loading:true,saving:false,error:''}));
export function setParticipantProfile(profile:ParticipantProfile){useParticipantStore.setState({profile,loading:false,error:''});}
