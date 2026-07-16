export type MarketResult={symbol:string;instrument_name:string;exchange?:string;instrument_type?:string;currency?:string;country?:string};

const apiKey=import.meta.env.VITE_TWELVE_DATA_API_KEY as string|undefined;
const endpoint='https://api.twelvedata.com';
export const marketDataConfigured=Boolean(apiKey);

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

export async function getEuroPrice(result:MarketResult){
 const quote=await request<{price:string}>('/price',{symbol:result.symbol,...(result.exchange?{exchange:result.exchange}:{})});
 const price=Number(quote.price);
 if(!Number.isFinite(price))throw new Error('Prezzo non disponibile');
 const currency=result.currency?.toUpperCase()||'EUR';
 if(currency==='EUR')return price;
 const fx=await request<{rate:string}>('/exchange_rate',{symbol:`${currency}/EUR`});
 const rate=Number(fx.rate);
 if(!Number.isFinite(rate))throw new Error(`Cambio ${currency}/EUR non disponibile`);
 return price*rate;
}
