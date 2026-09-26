// Use a server-configured public origin behind a TLS-terminating reverse proxy.
// Never trust client-supplied forwarded headers to choose an allowed origin.
export function isSameOrigin(req:Request,configuredOrigin?:unknown):boolean {
  if(req.headers.get('sec-fetch-site')==='cross-site')return false;
  let expected=new URL(req.url).origin;
  if(configuredOrigin!==undefined){
    if(typeof configuredOrigin!=='string'||!configuredOrigin)return false;
    try{
      const url=new URL(configuredOrigin);
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return false;
      expected=url.origin;
    }catch{return false;}
  }
  return req.headers.get('origin')===expected;
}
