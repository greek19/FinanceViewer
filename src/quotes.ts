import { doc,getDoc,serverTimestamp,setDoc,Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getEuroPrice,type MarketResult } from './market';

const MAX_AGE=24*60*60*1000;
const pending=new Map<string,Promise<number>>();
const quoteId=(result:MarketResult)=>`${result.symbol}_${result.exchange||'default'}`.replace(/[^a-z0-9_-]/gi,'_');

export async function getCachedEuroPrice(_uid:string,result:MarketResult){
 const id=quoteId(result),key=id;
 const active=pending.get(key);
 if(active)return active;
 const task=(async()=>{
  const ref=doc(db,'marketQuotes',id);
  let cached:{price?:number;fetchedAt?:number|Timestamp}|undefined;
  try{cached=(await getDoc(ref)).data() as typeof cached}catch{/* La quotazione viene comunque recuperata se la cache globale non è ancora abilitata. */}
  const fetchedAt=cached?.fetchedAt instanceof Timestamp?cached.fetchedAt.toMillis():cached?.fetchedAt;
  if(cached?.price!==undefined&&fetchedAt&&Date.now()-fetchedAt<MAX_AGE)return cached.price;
  const price=await getEuroPrice(result);
  const quoteUnit=result.exchange==='MOTX'?'PERCENT':'EUR';
  try{await setDoc(ref,{symbol:result.symbol,name:result.instrument_name,isin:result.isin||null,exchange:result.exchange||null,currency:result.currency||null,price,quoteUnit,fetchedAt:serverTimestamp()})}catch{/* Cache best effort: un conflitto non deve impedire l'inserimento dell'asset. */}
  return price;
 })();
 pending.set(key,task);
 try{return await task}finally{pending.delete(key)}
}
