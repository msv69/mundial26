// ============================================================
// ROUTER — micro-router HTTP nativo, senza dipendenze esterne
// Supporta GET/POST/PUT con parametri di percorso tipo :id
// ============================================================

function pathToRegex(routePath){
  const paramNames = [];
  const pattern = routePath
    .replace(/\/+$/,"")
    .split("/")
    .map(seg => {
      if(seg.startsWith(":")){
        paramNames.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${pattern}/?$`), paramNames };
}

class Router{
  constructor(){
    this.routes = []; // {method, regex, paramNames, handler}
  }
  add(method, routePath, handler){
    const { regex, paramNames } = pathToRegex(routePath);
    this.routes.push({ method, regex, paramNames, handler });
  }
  get(p, h){ this.add("GET", p, h); }
  post(p, h){ this.add("POST", p, h); }
  put(p, h){ this.add("PUT", p, h); }
  delete(p, h){ this.add("DELETE", p, h); }

  match(method, pathname){
    for(const r of this.routes){
      if(r.method !== method) continue;
      const m = r.regex.exec(pathname);
      if(m){
        const params = {};
        r.paramNames.forEach((name, i) => params[name] = decodeURIComponent(m[i + 1]));
        return { handler: r.handler, params };
      }
    }
    return null;
  }
}

function readJsonBody(req){
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if(data.length > 2_000_000){ reject(new Error("Body troppo grande")); req.destroy(); }
    });
    req.on("end", () => {
      if(!data) return resolve({});
      try{ resolve(JSON.parse(data)); }
      catch(e){ resolve({}); }
    });
    req.on("error", reject);
  });
}

module.exports = { Router, readJsonBody };
