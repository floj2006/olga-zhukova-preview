// Local Next server used by isolated browser tests. Production uses Next Route Handlers.
import http from 'node:http';
import next from 'next';
import { createApiHandler } from '../server/index.mjs';
export async function createSiteServer(options={}) {
 const api=await createApiHandler(options);
 const existing = new Map(['uncaughtException','unhandledRejection'].map(e=>[e,process.listeners(e)]));
 const app=next({dev:false,quiet:true});
 await app.prepare();
 for(const [event,listeners] of existing) for(const listener of process.listeners(event)) if(!listeners.includes(listener)) process.removeListener(event,listener);
 const render=app.getRequestHandler();
 const server=http.createServer(async(req,res)=>{
  if(await api(req,res))return;
  await render(req,res);
 });
 server.on('close',()=>{app.close();});
 return server;
}
