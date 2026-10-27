import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';
let pyodide,ns,sequence=0;const pending=new Map();
self.agentBridge=async(raw)=>{const request=JSON.parse(raw),id=++sequence;self.postMessage({type:'rpc',id,...request});return await new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));};
self.onmessage=async({data:d})=>{
 if(d.type==='rpc-result'){const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(d.error)):p.resolve(JSON.stringify(d.result));}return;}
 if(d.type!=='run')return;
 try {
  if(!pyodide){self.postMessage({type:'status',message:'브라우저에 Python 런타임을 불러오는 중…'});pyodide=await loadPyodide();pyodide.setStdout({batched:s=>self.postMessage({type:'print',text:s.slice(0,3000)})});pyodide.setStderr({batched:s=>self.postMessage({type:'print',text:s.slice(0,3000)})});}
  // One globals dictionary per case; student conversation memory survives turns.
  if(!ns || d.reset){ns?.destroy();ns=pyodide.runPython('dict()');ns.set('_initialized',false);}ns.set('_task_json',JSON.stringify(d.task));ns.set('_tools_json',JSON.stringify(d.tools));ns.set('_source',d.code);
  const result=await pyodide.runPythonAsync(`
import json
from js import agentBridge
class WorkshopAPI:
    tools = json.loads(_tools_json)
    async def chat(self, messages, tools=None):
        return json.loads(await agentBridge(json.dumps({"method":"chat","messages":messages,"tools":tools})))
    async def tool(self, name, arguments=None):
        return json.loads(await agentBridge(json.dumps({"method":"tool","name":name,"arguments":arguments or {}})))
if not _initialized:
    exec(compile(_source, "agent.py", "exec"), globals())
    _initialized = True
if not callable(globals().get("agent")):
    raise ValueError("async def agent(task, api)를 정의해주세요.")
__answer = await agent(json.loads(_task_json), WorkshopAPI())
json.dumps(__answer, ensure_ascii=False)
`,{globals:ns});
  self.postMessage({type:'done',answer:JSON.parse(result)});
 } catch(e){self.postMessage({type:'error',error:String(e.message||e).slice(-4000)});}
};
