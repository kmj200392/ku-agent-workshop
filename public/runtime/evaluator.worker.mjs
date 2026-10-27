import {loadBFCL} from './bfcl-loader.mjs';
let loading,queue=Promise.resolve();
self.onmessage=({data:d})=>{queue=queue.then(async()=>{
 try {
  const py=await (loading??=loadBFCL());py.globals.set('_request_json',JSON.stringify(d));
  const result=py.runPython(`
_r = json.loads(_request_json)
if _r['action'] == 'start':
    _world = WorkshopWorld(_r['test'], json.loads(_docs_json))
    _result = _world.setup()
elif _r['action'] == 'tool':
    _result = _world.tool(_r['name'], _r.get('args') or {})
elif _r['action'] == 'next':
    _result = _world.next(_r.get('answer'))
elif _r['action'] == 'grade':
    _result = _world.grade(_r.get('answer'))
else:
    raise ValueError('Unknown evaluator action')
json.dumps(_result, ensure_ascii=False)
`);
  self.postMessage({id:d.id,result:JSON.parse(result)});
 }catch(e){self.postMessage({id:d.id,error:String(e.message||e)});}
});};
