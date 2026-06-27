const https = require('https');
const qs = require('querystring');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CLIENT_ID = '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com';
const CLIENT_SECRET = 'v6V3fKV_zWU7iw1DrpO1rknX';
const REDIRECT_URI = 'http://localhost:8888';

const SCOPES = [
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.webapp.deploy',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/service.management',
  'https://www.googleapis.com/auth/logging.read',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cloud-platform',
  'openid',
  'email',
  'profile',
];

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${qs.stringify({
  redirect_uri: REDIRECT_URI,
  access_type: 'offline',
  scope: SCOPES.join(' '),
  response_type: 'code',
  client_id: CLIENT_ID,
  prompt: 'consent',
})}`;

const cmd = process.argv[2];

if (cmd === 'auth') {
  console.log('\n請在瀏覽器打開以下網址，授權後複製網址列的整串 URL 貼回來：\n');
  console.log(authUrl);
  console.log('\n貼上授權後的 URL (包含 ?code=... )：');
  process.stdin.once('data', (input) => {
    const inputUrl = input.toString().trim();
    let code;
    try {
      const parsed = new URL(inputUrl);
      code = parsed.searchParams.get('code');
    } catch {
      code = inputUrl;
    }
    if (!code) {
      console.error('無法解析 code，請確認貼上完整的 redirect URL');
      process.exit(1);
    }
    exchangeCode(code);
  });
} else if (cmd === 'push') {
  pushWithNode();
} else if (cmd === 'open') {
  console.log(authUrl);
} else {
  console.log('Usage: node clasp-auth.js <auth|open|push>');
}

function exchangeCode(code) {
  const postData = qs.stringify({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const req = https.request({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      if (res.statusCode !== 200) {
        console.error('Token 交換失敗:', data);
        process.exit(1);
      }
      const token = JSON.parse(data);
      const clasprc = {
        token: {
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          scope: token.scope,
          token_type: 'Bearer',
          expiry_date: Date.now() + token.expires_in * 1000,
        },
        oauth2ClientSettings: {
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          redirectUri: REDIRECT_URI,
        },
        isLocalCreds: false,
      };
      const home = process.env.HOME || process.env.USERPROFILE;
      const credPath = path.join(home, '.clasprc.json');
      fs.writeFileSync(credPath, JSON.stringify(clasprc, null, 2));
      console.log('登入成功！憑證已寫入:', credPath);
    });
  });
  req.on('error', e => console.error('錯誤:', e.message));
  req.write(postData);
  req.end();
}

function pushWithNode() {
  const { spawn } = require('child_process');
  const args = process.argv.slice(3);
  const child = spawn('node', [
    '--require', './clasp-fix.js',
    '--experimental-require-module',
    './node_modules/@google/clasp/build/src/index.js',
    ...args,
  ], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  child.on('exit', (code) => process.exit(code));
}
