const https = require('https');
const Module = require('module');

// 1) 忽略憑證驗證（部分環境有 TLS 中間人/企業代理）
const origAgent = https.Agent;
class PatchedAgent extends origAgent {
  constructor(options) {
    super({ ...options, rejectUnauthorized: false });
  }
}
https.Agent = PatchedAgent;
https.globalAgent = new PatchedAgent();

// 2) 修正 node-fetch 2.x 在新版 Node（實測 v26）的壓縮解析問題：
//    預設 compress:true 會讓 gzip 回應以 ERR_STREAM_PREMATURE_CLOSE 中斷，
//    導致 `clasp login` 出現
//    "Invalid response body while trying to fetch https://oauth2.googleapis.com/token: Premature close"。
//    解法：要求伺服器回傳未壓縮內容（accept-encoding: identity）並關閉 node-fetch 解壓。
//    注意不可只設 compress:false —— gaxios 會自帶 accept-encoding: gzip，
//    那會讓 body 變成未解壓的二進位（clasp deploy 會印出亂碼）。
const origLoad = Module._load;
let patchedFetch = null;

function wrapNodeFetch(nf) {
  if (patchedFetch) return patchedFetch;
  const wrapped = function (url, opts) {
    const merged = Object.assign({}, opts);
    merged.compress = false;
    const headers = Object.assign({}, merged.headers);
    // Headers 可能是 node-fetch 的 Headers 實例或一般物件
    if (headers && typeof headers.forEach === 'function' && typeof headers.get === 'function') {
      headers.set('accept-encoding', 'identity');
    } else {
      Object.keys(headers).forEach(function (k) {
        if (k.toLowerCase() === 'accept-encoding') delete headers[k];
      });
      headers['accept-encoding'] = 'identity';
    }
    merged.headers = headers;
    return nf(url, merged);
  };
  Object.assign(wrapped, nf);
  wrapped.default = wrapped;
  patchedFetch = wrapped;
  return wrapped;
}

Module._load = function (request, parent, isMain) {
  const exp = origLoad.apply(this, arguments);
  if (request === 'node-fetch' && typeof exp === 'function' && !exp.__claspFixWrapped) {
    const wrapped = wrapNodeFetch(exp);
    try { wrapped.__claspFixWrapped = true; } catch (e) {}
    return wrapped;
  }
  return exp;
};
