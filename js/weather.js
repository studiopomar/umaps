export const API_URL='https://api.open-meteo.com/v1/forecast';
export const ATTRIBUTION_URL='https://open-meteo.com/';
const cache=new Map();
let capitalsCache=null;
const conditions={
 0:['☀️','Céu limpo'],1:['🌤️','Predomínio de sol'],2:['⛅','Parcialmente nublado'],3:['☁️','Encoberto'],
 45:['🌫️','Neblina'],48:['🌫️','Nevoeiro'],51:['🌦️','Garoa leve'],53:['🌦️','Garoa'],55:['🌧️','Garoa intensa'],
 56:['🌧️','Garoa congelante'],57:['🌧️','Garoa congelante intensa'],61:['🌧️','Chuva leve'],63:['🌧️','Chuva'],65:['🌧️','Chuva intensa'],
 66:['🌧️','Chuva congelante'],67:['🌧️','Chuva congelante intensa'],71:['🌨️','Neve leve'],73:['🌨️','Neve'],75:['❄️','Neve intensa'],77:['🌨️','Grãos de neve'],
 80:['🌦️','Pancadas de chuva leves'],81:['🌧️','Pancadas de chuva'],82:['🌧️','Pancadas de chuva fortes'],85:['🌨️','Pancadas de neve leves'],86:['🌨️','Pancadas de neve fortes'],
 95:['⛈️','Trovoada'],96:['⛈️','Trovoada e granizo leve'],99:['⛈️','Trovoada e granizo']
};
export function describeWeather(code){return conditions[code]||['🌡️','Condição não informada'];}
export function buildForecastUrl(city){
 const url=new URL(API_URL);
 url.search=new URLSearchParams({latitude:String(city.lat),longitude:String(city.lng),daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',forecast_days:'3',timezone:city.timezone,temperature_unit:'celsius'});
 return url;
}
export function buildCapitalsWeatherUrl(capitals,cities){
 const places=capitals.map(capital=>cities.find(city=>city.id===capital.cityId));
 if(places.some(city=>!city))throw Error('Capital ausente no catálogo');
 const url=new URL(API_URL);
 url.search=new URLSearchParams({latitude:places.map(city=>city.lat).join(','),longitude:places.map(city=>city.lng).join(','),current:'temperature_2m,weather_code',daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max',forecast_days:'1',timezone:'auto',temperature_unit:'celsius'});
 return url;
}
export async function getCapitalsWeather(capitals,cities,fetcher=fetch){
 if(capitalsCache&&capitalsCache.expires>Date.now())return capitalsCache.value;
 const response=await fetcher(buildCapitalsWeatherUrl(capitals,cities),{signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error(`Serviço de previsão retornou ${response.status}`);
 const payload=await response.json(),items=Array.isArray(payload)?payload:[payload];
 if(items.length!==capitals.length)throw Error('Previsão incompleta para as capitais');
 const value=items.map((item,index)=>{
  const current=item.current,daily=item.daily,city=cities.find(entry=>entry.id===capitals[index].cityId);
  const max=daily?.temperature_2m_max?.[0],min=daily?.temperature_2m_min?.[0],rain=daily?.precipitation_probability_max?.[0];
  if(!city||!Number.isFinite(current?.temperature_2m)||!Number.isFinite(current?.weather_code)||!Number.isFinite(max)||!Number.isFinite(min))throw Error('Previsão incompleta para uma capital');
  return {cityId:city.id,country:capitalName(capitals[index],city),name:city.name,timezone:item.timezone,current:current.temperature_2m,code:current.weather_code,max,min,rain:Number.isFinite(rain)?rain:null,updatedAt:current.time};
 });
 capitalsCache={expires:Date.now()+12*60*1000,value};return value;
}
function capitalName(capital,city){return capital.country||city.country;}
export function parseForecast(data){
 const d=data?.daily;
 if(!d||!Array.isArray(d.time)||!Array.isArray(d.weather_code)||!Array.isArray(d.temperature_2m_max)||!Array.isArray(d.temperature_2m_min)||!Array.isArray(d.precipitation_probability_max))throw Error('Previsão indisponível');
 const days=d.time.map((date,i)=>({date,code:d.weather_code[i],max:d.temperature_2m_max[i],min:d.temperature_2m_min[i],rain:d.precipitation_probability_max[i]}));
 if(days.length<3||days.some(day=>typeof day.date!=='string'||!Number.isFinite(day.code)||!Number.isFinite(day.max)||!Number.isFinite(day.min)))throw Error('Resposta de previsão incompleta');
 return {timezone:data.timezone,days};
}
export async function getForecast(city,fetcher=fetch){
 const cached=cache.get(city.id);
 if(cached&&cached.expires>Date.now())return cached.value;
 if(cached?.pending)return cached.pending;
 const pending=(async()=>{
  const response=await fetcher(buildForecastUrl(city),{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error(`Serviço de previsão retornou ${response.status}`);
  const value=parseForecast(await response.json());cache.set(city.id,{expires:Date.now()+30*60*1000,value});return value;
 })();
 cache.set(city.id,{pending});
 try{return await pending;}catch(error){cache.delete(city.id);throw error;}
}
export function clearForecastCache(){cache.clear();}
