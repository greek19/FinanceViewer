import governmentBondCatalog from './data/italian-government-bonds.json';

export type MarketResult={symbol:string;instrument_name:string;exchange?:string;instrument_type?:string;currency?:string;country?:string;isin?:string;priceAvailable?:boolean};

const apiKey=import.meta.env.VITE_TWELVE_DATA_API_KEY as string|undefined;
const alphaKey=import.meta.env.VITE_ALPHA_VANTAGE_API_KEY as string|undefined;
const finnhubKey=import.meta.env.VITE_FINNHUB_API_KEY as string|undefined;
const endpoint='https://api.twelvedata.com';
export const marketDataConfigured=Boolean(apiKey);
let alphaQueue=Promise.resolve();
let lastAlphaRequest=0;

const governmentBondResults=(term:string):MarketResult[]=>{
 const query=term.trim().toLocaleLowerCase('it-IT');
 return governmentBondCatalog.bonds
  .filter(bond=>bond.isin.toLowerCase().includes(query)||bond.name.toLocaleLowerCase('it-IT').includes(query)||bond.type.toLocaleLowerCase('it-IT').includes(query))
  .sort((a,b)=>Number(b.isin.toLowerCase()===query)-Number(a.isin.toLowerCase()===query)||a.name.localeCompare(b.name,'it'))
  .slice(0,8)
  .map(bond=>({symbol:bond.isin,instrument_name:bond.name,instrument_type:'Government Bond',currency:'EUR',country:'Italy',isin:bond.isin,priceAvailable:false}));
};

async function request<T>(path:string,params:Record<string,string>,signal?:AbortSignal):Promise<T>{
 const query=new URLSearchParams({...params,apikey:apiKey||''});
 const response=await fetch(`${endpoint}${path}?${query}`,{signal});
 const data=await response.json();
 if(!response.ok||data.status==='error')throw new Error(data.message||'Servizio quotazioni non disponibile');
 return data as T;
}

export async function searchMarket(term:string,signal?:AbortSignal){
 const normalized=term.trim().toUpperCase();
 const governmentBonds=governmentBondResults(term);
 if(governmentBonds.length)return governmentBonds;
 if(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalized)){
  if(!finnhubKey)throw new Error('Configura VITE_FINNHUB_API_KEY per cercare le obbligazioni tramite ISIN.');
  const query=new URLSearchParams({q:normalized,token:finnhubKey});
  const response=await fetch(`https://finnhub.io/api/v1/search?${query}`,{signal});
  const result=await response.json();
  if(!response.ok||result.error)throw new Error(result.error||'Ricerca ISIN momentaneamente non disponibile.');
  return ((result.result||[]) as Array<{symbol:string;displaySymbol?:string;description?:string;type?:string}>).slice(0,8).map(item=>({symbol:item.symbol,instrument_name:item.description||item.displaySymbol||normalized,instrument_type:item.type||'Bond',isin:normalized}));
 }
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
 if(result.priceAvailable===false)throw new Error('Prezzo corrente da inserire manualmente per questo titolo di Stato.');
 try{
  const quote=await request<{price:string}>('/price',{symbol:result.symbol,...(result.exchange?{exchange:result.exchange}:{})});
  const price=Number(quote.price);
  if(!Number.isFinite(price))throw new Error('Prezzo non disponibile');
  return toEuro(price,result.currency||'EUR');
 }catch{return getAlphaVantagePrice(result)}
}
