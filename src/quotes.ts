import { doc,getDoc,setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getEuroPrice,type MarketResult } from './market';

const MAX_AGE=24*60*60*1000;
const pending=new Map<string,Promise<number>>();
const quoteId=(result:MarketResult)=>`${result.symbol}_${result.exchange||'default'}`.replace(/[^a-z0-9_-]/gi,'_');

export async function getCachedEuroPrice(uid:string,result:MarketResult){
 const id=quoteId(result),key=`${uid}/${id}`;
 const active=pending.get(key);
 if(active)return active;
 const task=(async()=>{
  const ref=doc(db,'users',uid,'marketQuotes',id);
  const snapshot=await getDoc(ref);
  const cached=snapshot.data() as {priceEur?:number;fetchedAt?:number}|undefined;
  if(cached?.priceEur!==undefined&&cached.fetchedAt&&Date.now()-cached.fetchedAt<MAX_AGE)return cached.priceEur;
  const priceEur=await getEuroPrice(result);
  await setDoc(ref,{symbol:result.symbol,name:result.instrument_name,isin:result.isin||null,exchange:result.exchange||null,currency:result.currency||null,priceEur,fetchedAt:Date.now()});
  return priceEur;
 })();
 pending.set(key,task);
 try{return await task}finally{pending.delete(key)}
}
