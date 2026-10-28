const assert=require('node:assert/strict');
async function disclosureState(page){const value=await page.locator('#spoilerRange').inputValue();assert.ok(['basic','all'].includes(value));return String(value==='all');}
async function toggleDisclosure(page){const value=await page.locator('#spoilerRange').inputValue();assert.ok(['basic','all'].includes(value));await page.locator('#spoilerRange').selectOption(value==='all'?'basic':'all');}
module.exports={disclosureState,toggleDisclosure};
