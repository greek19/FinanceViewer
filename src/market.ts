export type MarketResult={symbol:string;instrument_name:string;exchange?:string;instrument_type?:string;currency?:string;country?:string};

const apiKey=import.meta.env.VITE_TWELVE_DATA_API_KEY as string|undefined;
const alphaKey=import.meta.env.VITE_ALPHA_VANTAGE_API_KEY as string|undefined;
const endpoint='https://api.twelvedata.com';
export const marketDataConfigured=Boolean(apiKey);
let alphaQueue=Promise.resolve();
let lastAlphaRequest=0;

async function request<T>(path:string,params:Record<string,string>,signal?:AbortSignal):Promise<T>{
 const query=new URLSearchParams({...params,apikey:apiKey||''});
 const response=await fetch(`${endpoint}${path}?${query}`,{signal});
 const data=await response.json();
 if(!response.ok||data.status==='error')throw new Error(data.message||'Servizio quotazioni non disponibile');
 return data as T;
}

export async function searchMarket(term:string,signal?:AbortSignal){
 const result=await request<{data?:MarketResult[]}>('/symbol_search',{symbol:term,outputsize:'8'},signal);
 return result.data||[];
}

async function toEuro(price:number,currency:string){
 const normalized=currency.toUpperCase()==='GBX'?{price:price/100,currency:'GBP'}:{price,currency:currency.toUpperCase()};
 if(normalized.currency==='EUR')return normalized.price;
 const fx=await request<{rate:string}>('/exchange_rate',{symbol:`${normalized.currency}/EUR`});
 const rate=Number(fx.rate);
 if(!Number.isFinite(rate))throw new Error(`Cambio ${normalized.currency}/EUR non disponibile`);
 return normalized.price*rate;
}

async function alphaRequest(params:Record<string,string>){
 const run=async()=>{
  const wait=Math.max(0,1100-(Date.now()-lastAlphaRequest));
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  lastAlphaRequest=Date.now();
  const query=new URLSearchParams({...params,apikey:alphaKey||''});
  const response=await fetch(`https://www.alphavantage.co/query?${query}`);
  const data=await response.json();
  if(!response.ok)throw new Error('Alpha Vantage momentaneamente non disponibile.');
  if(data.Information||data.Note)throw new Error('Limite gratuito temporaneamente raggiunto. Riprova tra qualche secondo.');
  return data;
 };
 const result=alphaQueue.then(run,run);
 alphaQueue=result.then(()=>undefined,()=>undefined);
 return result;
}

async function getAlphaVantagePrice(result:MarketResult){
 if(!alphaKey)throw new Error('Prezzo non incluso nel piano gratuito di Twelve Data. Inseriscilo manualmente oppure configura il fallback gratuito Alpha Vantage.');
 const search=await alphaRequest({function:'SYMBOL_SEARCH',keywords:result.symbol});
 const matches=(search.bestMatches||[]) as Record<string,string>[];
 const base=result.symbol.replace(/[^A-Z0-9]/gi,'').toUpperCase();
 const match=matches.find(x=>(x['1. symbol']||'').split('.')[0].toUpperCase()===base)||matches[0];
 if(!match)throw new Error('Prezzo non disponibile gratuitamente per questo strumento. Puoi inserirlo manualmente.');
 const quote=await alphaRequest({function:'GLOBAL_QUOTE',symbol:match['1. symbol']});
 const price=Number(quote['Global Quote']?.['05. price']);
 if(!Number.isFinite(price)||price<=0)throw new Error('Quotazione gratuita momentaneamente non disponibile. Puoi inserire il prezzo manualmente.');
 return toEuro(price,match['8. currency']||result.currency||'EUR');
}

export async function getEuroPrice(result:MarketResult){
 try{
  const quote=await request<{price:string}>('/price',{symbol:result.symbol,...(result.exchange?{exchange:result.exchange}:{})});
  const price=Number(quote.price);
  if(!Number.isFinite(price))throw new Error('Prezzo non disponibile');
  return toEuro(price,result.currency||'EUR');
 }catch{return getAlphaVantagePrice(result)}
}
