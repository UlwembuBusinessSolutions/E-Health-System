import type { Plugin } from "vite";
import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
// Local Vite middleware only: never included in production build or preview.
export function pharmacyConcurrency(): Plugin {
  let result = {state:"idle", message:""};
  return {name:"local-pharmacy-concurrency", apply:"serve", configureServer(server) {
    server.middlewares.use("/__local/pharmacy-concurrency", (req,res) => {
      res.setHeader("Content-Type","application/json");
      res.setHeader("Cache-Control","no-store");
      const host = req.headers.host ?? "";
      const remote = req.socket.remoteAddress ?? "";
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || !["127.0.0.1","::1","::ffff:127.0.0.1"].includes(remote)) {res.statusCode=403;res.end('{}');return;}
      if (req.method === "POST") {
        if (req.headers.origin !== "http://"+host || req.headers["x-pharmacy-development-check"] !== "1") {res.statusCode=403;res.end('{}');return;}
        if (result.state !== "running") {
          const backend = process.env.PHARMACY_BACKEND_DIR ?? path.resolve(server.config.root,"../../E-Health-System-dev-backend-ulwembu (2)/E-Health-System-dev-backend-ulwembu");
          const script = path.join(backend,"docs/testing/RunPharmacyConcurrency.ps1");
          if (!existsSync(script)) {result={state:"failed",message:"Set PHARMACY_BACKEND_DIR to the backend project and restart Vite."};}
          else {
            result={state:"running",message:"Running real PostgreSQL transactions in an isolated test schema. Clinic stock is unchanged."};
            const child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-File",script],{cwd:backend,windowsHide:true,stdio:"ignore"});
            child.on("error",()=>{result={state:"failed",message:"Unable to launch local test. Check Java, Maven and PostgreSQL."};});
            child.on("exit",code=>{result=code===0?{state:"passed",message:"Passed: 30 - 7 - 11 = 12. Ledger balances, insufficient-stock rejection and rollback verified. Clinic stock unchanged."}:{state:"failed",message:"Test failed. See backend target/pharmacy-concurrency.log for details."};});
          }
        }
        res.statusCode=202;
      } else if (req.method !== "GET") {res.statusCode=405;res.end('{}');return;}
      res.end(JSON.stringify(result));
    });
  }};
}
