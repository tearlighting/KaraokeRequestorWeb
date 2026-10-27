import { expect, test } from '@playwright/test';
import { testCredentials } from '../../../packages/test-support/src/client';

const appUrl=(route:string)=>`${(process.env.E2E_APP_PATH||'/').replace(/\/$/,'')}/${route}`;

test('Admin settings expose supported strategies, initial volume and reservation rules',async({page})=>{
  await page.goto(appUrl('settings'));
  if(await page.getByTestId('admin-login').isVisible().catch(()=>false)){
    const credentials=testCredentials();
    await page.getByTestId('admin-password').fill(credentials.password);
    if(credentials.easyPass){await page.locator('details summary').click();await page.locator('#easy-pass').fill(credentials.easyPass);}
    await page.getByTestId('admin-login').click();
  }
  await page.getByTestId('admin-nav-settings').click();
  await expect(page.getByTestId('settings-playmode')).toBeVisible();
  await expect(page.getByTestId('settings-playmode').locator('option[value="1"]')).toHaveCount(1);
  await expect(page.getByTestId('settings-playmode').locator('option[value="2"]')).toHaveCount(1);
  await expect(page.getByTestId('settings-startvolume')).toHaveAttribute('min','0');
  await expect(page.getByTestId('settings-startvolume')).toHaveAttribute('max','100');
  await expect(page.getByTestId('settings-request-automove')).toBeVisible();
  await expect(page.getByTestId('settings-request-automove-reset')).toBeVisible();
  await expect(page.getByTestId('settings-request-automove-midjoin')).toBeVisible();
  await page.getByTestId('admin-nav-playback').click();
  await expect(page).toHaveURL(/\/playback$/);
  await expect(page.getByTestId('admin-playback-console')).toBeVisible();
});
