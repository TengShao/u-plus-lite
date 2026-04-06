const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`ERROR: ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  try {
    // Login
    console.log('=== LOGGING IN ===');
    await page.goto('http://localhost:3003/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="text"]', '邵腾');
    await page.fill('input[type="password"]', '88888888');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    console.log('Logged in, URL:', page.url());

    // Check sessionStorage for draft keys
    const sessionStorageKeys = await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.includes('draft')) {
          keys.push(`${key}: ${sessionStorage.getItem(key)}`);
        }
      }
      return keys;
    });
    console.log('SessionStorage draft keys:', sessionStorageKeys);

    // Wait for requirements to load
    await page.waitForTimeout(2000);

    // Check which cycle is loaded
    const cycleInfo = await page.evaluate(() => {
      const url = window.location.href;
      return { url };
    });
    console.log('Page info:', cycleInfo);

    // Check requirements from API directly
    const apiResponse = await page.evaluate(async () => {
      const res = await fetch('/api/cycles');
      const cycles = await res.json();
      return cycles;
    });
    console.log('Cycles:', JSON.stringify(apiResponse));

    // Check which cycle is currently selected (look at sidebar)
    const sidebarText = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"]') || document.querySelector('[class*="Sidebar"]');
      return sidebar ? sidebar.textContent.substring(0, 500) : 'not found';
    });
    console.log('Sidebar text:', sidebarText.substring(0, 300));

    // Get the current cycleId from the page state
    const currentCycle = await page.evaluate(() => {
      // Try to find cycle info in the page
      const cycleElements = document.querySelectorAll('*');
      for (const el of cycleElements) {
        if (el.textContent && el.textContent.includes('4月') && el.textContent.includes('3.26')) {
          return 'Found 4月 cycle element';
        }
      }
      return '4月 cycle not found in DOM';
    });
    console.log('Current cycle check:', currentCycle);

    // Get ALL sessionStorage keys to understand what's there
    const allKeys = await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        keys.push(key);
      }
      return keys;
    });
    console.log('All sessionStorage keys:', allKeys);

    // Get all draft-related keys with values
    const draftKeys = await page.evaluate(() => {
      const result = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('draft') || key.includes('Draft'))) {
          result[key] = sessionStorage.getItem(key);
        }
      }
      return result;
    });
    console.log('Draft keys with values:', JSON.stringify(draftKeys));

    // Now trigger a refresh and capture the exact sequence
    console.log('\n=== REFRESHING PAGE ===');

    // Intercept network requests during refresh
    let requirementsRequest = null;
    page.on('request', req => {
      if (req.url().includes('/api/cycles/') && req.url().includes('/requirements')) {
        requirementsRequest = req.url();
        console.log('REQUIREMENTS REQUEST:', req.url());
      }
    });

    page.on('response', async res => {
      if (res.url().includes('/api/cycles/') && res.url().includes('/requirements')) {
        const body = await res.json();
        console.log('REQUIREMENTS RESPONSE for', res.url());
        console.log('  Count:', body.length);
        console.log('  Draft IDs:', body.filter(r => r.isDraft).map(r => r.id));
        const draft481 = body.find(r => r.id === 481);
        if (draft481) {
          console.log('  RG 481 isDraft:', draft481.isDraft, 'name:', draft481.name);
        } else {
          console.log('  RG 481 NOT in response');
        }
      }
    });

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('\n=== AFTER REFRESH ===');

    // Check sessionStorage again
    const draftKeysAfter = await page.evaluate(() => {
      const result = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('draft') || key.includes('Draft'))) {
          result[key] = sessionStorage.getItem(key);
        }
      }
      return result;
    });
    console.log('Draft keys after refresh:', JSON.stringify(draftKeysAfter));

    // Check DOM for requirement cards
    const cardIds = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-req-id]');
      return Array.from(cards).map(c => c.getAttribute('data-req-id')).sort();
    });
    console.log('Cards in DOM after refresh:', cardIds);
    console.log('RG 481 in DOM:', cardIds.includes('481'));

    // Get expandedIds state by checking which cards are expanded
    const expandedCards = await page.evaluate(() => {
      const expanded = document.querySelectorAll('[data-req-id]');
      return Array.from(expanded)
        .filter(c => c.querySelector('[class*="RequirementCardExpanded"]') || c.querySelector('[class*="expanded"]'))
        .map(c => c.getAttribute('data-req-id'));
    });
    console.log('Expanded cards:', expandedCards);

    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(e => console.log(e));
    } else {
      console.log('\nNo console errors!');
    }

  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    await browser.close();
  }
})();
