import {test,expect} from '@playwright/test';
async function ready(page){await page.goto('./');await expect(page.locator('.person')).toHaveCount(336);}
async function select(page,name){await page.locator('#search').fill(name);await page.locator('.add').first().click();}
async function travel(page){await select(page,'Finn');await select(page,'VIICTOR');await page.getByRole('tab',{name:'Nosso encontro'}).click();await page.locator('#meeting-country').selectOption('Japão');await page.locator('#city').selectOption('toquio');await page.locator('#topic').selectOption('oto');await page.locator('#meeting-submit').click();}
test('meeting confirmation stays reachable with two to four people, even after opening chat',async({page})=>{
 await ready(page);await select(page,'Finn');await select(page,'VIICTOR');
 const submit=page.locator('#meeting-submit');await expect(submit).toBeEnabled();
 await select(page,'Agata');await expect(page.locator('#selected-count')).toHaveText('3');await expect(submit).toBeEnabled();
 await select(page,'AK1');await expect(page.locator('#selected-count')).toHaveText('4');await expect(submit).toBeEnabled();
 await page.locator('#chat-launcher').click();await expect(page.locator('#conversation')).toBeVisible();
 await page.getByRole('tab',{name:'Nosso encontro'}).click();await expect(page.locator('#conversation')).toBeHidden();
 await page.locator('#meeting-country').selectOption('Japão');await page.locator('#city').selectOption('toquio');await submit.scrollIntoViewIfNeeded();await expect(submit).toBeInViewport();await submit.click();
 await expect(page.locator('#journey')).toContainText('A caminho de Tóquio');
});
test('desktop: source, groups, trip, branching dialogue, reload and restore',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});await ready(page);
 await expect(page.locator('.marker').first()).toBeVisible();await page.locator('.marker').first().click();await expect(page.locator('#globe-card')).toBeVisible();await expect(page.locator('.globe-card-list')).toBeVisible();await page.locator('#search').fill('Finn');await page.locator('.person-open').click();await expect(page.locator('.profile')).toContainText('Plataformas na wiki');await expect(page.locator('.profile a')).toHaveAttribute('href',/Finn_Barringtone/);
 await travel(page);await expect(page.locator('#journey')).toContainText('A caminho de Tóquio');await expect(page.locator('#journey')).toContainText('Encontro em Tóquio',{timeout:10000});await page.locator('#choices button').first().click();await page.locator('#choices button').nth(1).click();await expect(page.getByRole('button',{name:'Continuar a conversa'})).toBeVisible();
 await page.reload();await expect(page.locator('#journey')).toContainText('Encontro em Tóquio');await expect(page.locator('#messages')).toContainText('Você');await expect(page.getByRole('button',{name:'Continuar a conversa'})).toBeVisible();
 await page.getByRole('tab',{name:'Explorar',exact:true}).click();await page.locator('#search').fill('Finn');await page.locator('.person-open').click();await expect(page.locator('.profile')).toContainText('Tóquio, Japão');await page.locator('#settings').click();await page.locator('#restore').click();await expect(page.locator('#data-status')).toContainText('restaurados');expect(errors).toEqual([]);
});
test('mobile: touch, collapsed panel, reduced motion, keyboard and no horizontal overflow',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();await ready(page);await page.locator('#collapse').tap();await expect(page.locator('#collapse')).toHaveAttribute('aria-expanded','false');await page.locator('#collapse').tap();await page.locator('#search').fill('Agata');await page.locator('#search').press('Enter');await expect(page.locator('.profile h3')).toContainText('Agata');await page.locator('#explore-tab').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#meeting-tab')).toHaveAttribute('aria-selected','true');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
});
test('no WebGL, unavailable storage, missing portraits and wiki failure keep meeting usable',async({page})=>{
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;Object.defineProperty(window,'localStorage',{get(){throw Error('Unavailable');}});});
 await page.route('https://static.wikia.nocookie.net/**',route=>route.abort());await page.route('https://vsynthbr.fandom.com/**',route=>route.abort());await ready(page);await expect(page.locator('#globe-status')).toContainText('Globo indisponível');await page.locator('#refresh').click();await expect(page.locator('#wiki-status')).toContainText('Wiki indisponível');await travel(page);await page.getByRole('button',{name:'Chegar agora'}).click();await page.locator('#choices button').first().click();await expect(page.locator('#messages')).toContainText('Você');await page.getByRole('tab',{name:'Explorar',exact:true}).click();await page.locator('#search').fill('Agata');await expect(page.locator('.person img')).toHaveAttribute('src','./assets/avatar.svg');
});
test('paused trip survives reload and can explicitly arrive',async({page})=>{
 await ready(page);await page.locator('#pause').click();await travel(page);await page.reload();await expect(page.locator('#journey')).toContainText('Viagem pausada');await page.getByRole('button',{name:'Chegar agora'}).click();await expect(page.locator('#choices button')).toHaveCount(2);await page.locator('#settings').click();await page.locator('#clear').click();await expect(page.locator('#data-status')).toContainText('apagados');expect(await page.evaluate(()=>localStorage.getItem('umaps:v2'))).toBeNull();
});
