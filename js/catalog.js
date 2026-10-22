export const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export function validateCatalog(characters, cities, capitals=[]) {
  const ids = new Set();
  for (const city of cities) {
    if (ids.has(city.id) || !Number.isFinite(city.lat) || Math.abs(city.lat)>90 || !Number.isFinite(city.lng) || Math.abs(city.lng)>180) throw Error('Cidade inválida');
    new Intl.DateTimeFormat('pt-BR', {timeZone:city.timezone}); ids.add(city.id);
  }
  const people = new Set();
  for (const person of characters) {
    if (people.has(person.id) || !ids.has(person.defaultCity) || !/^https:\/\/vsynthbr\.fandom\.com\/pt-br\/wiki\//.test(person.source)) throw Error('Personagem inválido');
    people.add(person.id);
  }
  const capitalCountries=new Set();
  for(const capital of capitals){const city=cities.find(item=>item.id===capital.cityId);if(!city||city.country!==capital.country||capitalCountries.has(capital.country))throw Error('Capital inválida');capitalCountries.add(capital.country);}
}
export async function loadCatalog() {
  const [data, cities, capitals] = await Promise.all(['characters','cities','capitals'].map(async name => {
    const response = await fetch(`./data/${name}.json`); if (!response.ok) throw Error('Catálogo indisponível'); return response.json();
  }));
  validateCatalog(data.characters, cities,capitals); return {characters:data.characters,cities,capitals};
}
// Refresh only reviewed IDs: membership in a general voicebank category is not proof of Brazilian origin.
export async function refreshCatalog(characters) {
  const updated = characters.map(p=>({...p}));
  for (let i=0;i<updated.length;i+=40) {
    const chunk=updated.slice(i,i+40);
    const url=new URL('https://vsynthbr.fandom.com/pt-br/api.php');
    url.search=new URLSearchParams({action:'query',prop:'pageimages',pageids:chunk.map(p=>p.pageId).join('|'),piprop:'thumbnail',pithumbsize:'160',format:'json',origin:'*'});
    const response=await fetch(url,{signal:AbortSignal.timeout(8000)}); if (!response.ok) throw Error('Wiki indisponível');
    const data=await response.json(); if (!data.query?.pages) throw Error('Resposta inválida');
    for (const person of chunk) {
      const page=data.query.pages[person.pageId];
      if (page?.thumbnail?.source?.startsWith('https://')) person.image=page.thumbnail.source;
    }
  }
  return updated;
}
