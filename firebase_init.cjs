const http = require('http');
const { execSync } = require('child_process');

function httpGet(url) {
  return new Promise((res, rej) => {
    http.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    }).on('error', rej);
  });
}

async function main() {
  const ws_module = require('ws');
  const WebSocket = ws_module.WebSocket || ws_module;
  const ACCESS_TOKEN = process.env.GCLOUD_TOKEN;
  
  const targets = await httpGet('http://localhost:9223/json');
  console.log('Targets:', targets.length, targets[0]?.url);
  const target = targets[0];
  
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  
  let msgId = 1;
  const pending = new Map();
  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    }
  });
  
  const call = (method, params) => new Promise((res, rej) => {
    const id = msgId++;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  
  await call('Network.enable', {});
  await call('Page.enable', {});
  
  // Navigate to Google auth with access token
  const authUrl = 'https://accounts.google.com/accounts/OAuthLogin?source=googletoolbar&issueuberauth=1&access_token=' + ACCESS_TOKEN;
  console.log('Navigating to Google auth...');
  await call('Page.navigate', { url: authUrl });
  await new Promise(r => setTimeout(r, 5000));
  
  const titleResult = await call('Runtime.evaluate', { 
    expression: 'document.title + " | " + location.href.substring(0, 80)' 
  });
  console.log('At:', titleResult.result.value);
  
  const cookieResult = await call('Network.getAllCookies', {});
  const gCookies = (cookieResult.cookies || []).filter(c => c.domain.includes('google.com'));
  console.log('Google cookies:', gCookies.map(c => c.name).join(', '));
  
  // If we got session cookies, navigate to Firebase Console
  if (gCookies.length > 2) {
    console.log('Got Google session! Navigating to Firebase Console auth...');
    await call('Page.navigate', { 
      url: 'https://console.firebase.google.com/project/my-boards-app-2026/authentication' 
    });
    await new Promise(r => setTimeout(r, 12000));
    
    const r2 = await call('Runtime.evaluate', { 
      expression: 'document.title' 
    });
    console.log('Firebase Console:', r2.result.value);
    
    // Try to click "Get started"
    const clickResult = await call('Runtime.evaluate', {
      expression: `
        var btn = Array.from(document.querySelectorAll('button, a, [role=button]'))
          .find(el => el.textContent.trim() === 'Get started');
        btn ? (btn.click(), 'clicked: ' + btn.textContent.trim()) 
            : 'not found - buttons: ' + Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0,20)).join('|');
      `
    });
    console.log('Click result:', clickResult.result.value);
  } else {
    console.log('No Google session established');
  }
  
  ws.close();
}

main().catch(e => console.error('Error:', e.message));
