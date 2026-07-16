import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase'; import type { Asset,Movement,Pac } from './types';
export const watch=<T>(uid:string,key:string,cb:(v:T[])=>void)=>onSnapshot(collection(db,'users',uid,key),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}) as T)));
const withoutUndefined=<T extends object>(value:T)=>Object.fromEntries(Object.entries(value).filter(([,field])=>field!==undefined)) as T;
export const save=<T extends {id:string}>(uid:string,key:string,v:T)=>setDoc(doc(db,'users',uid,key,v.id),withoutUndefined(v));
export async function saveMany<T extends {id:string}>(uid:string,key:string,values:T[]){const batch=writeBatch(db);values.forEach(value=>batch.set(doc(db,'users',uid,key,value.id),withoutUndefined(value)));await batch.commit()}
export const remove=(uid:string,key:string,id:string)=>deleteDoc(doc(db,'users',uid,key,id));
const iso=(d:Date)=>d.toISOString().slice(0,10);
export async function materializePacs(uid:string,pacs:Pac[]){const today=new Date(); const batch=writeBatch(db); let count=0;
 for(const p of pacs.filter(x=>x.active)){let cursor=new Date(p.lastGenerated||p.startDate); if(p.lastGenerated) cursor.setMonth(cursor.getMonth()+1); cursor.setDate(Math.min(p.day,new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate()));
  while(cursor<=today && (!p.endDate||iso(cursor)<=p.endDate) && count<120){const id=`${p.id}_${iso(cursor)}`; const m:Movement={id,assetId:p.assetId,assetName:p.assetName,type:'Versamento',amount:p.amount,date:iso(cursor),pacId:p.id,notes:'Generato automaticamente dal PAC'}; batch.set(doc(db,'users',uid,'movements',id),m,{merge:true}); p.lastGenerated=iso(cursor); batch.set(doc(db,'users',uid,'pacs',p.id),p,{merge:true}); cursor.setMonth(cursor.getMonth()+1); count++;}
 } if(count) await batch.commit(); return count; }
export type {Asset,Movement,Pac};
