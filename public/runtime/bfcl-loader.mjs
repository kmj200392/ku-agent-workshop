import {loadPyodide} from 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';
export async function loadBFCL() {
 const base='/benchmarks/bfcl/';
 const files=['workshop_bridge.py','bfcl_eval/__init__.py','bfcl_eval/constants/__init__.py','bfcl_eval/constants/executable_backend_config.py','bfcl_eval/eval_checker/__init__.py','bfcl_eval/eval_checker/multi_turn_eval/__init__.py','bfcl_eval/eval_checker/multi_turn_eval/multi_turn_checker.py','bfcl_eval/eval_checker/multi_turn_eval/multi_turn_utils.py','bfcl_eval/eval_checker/multi_turn_eval/func_source_code/__init__.py','bfcl_eval/eval_checker/multi_turn_eval/func_source_code/travel_booking.py','bfcl_eval/eval_checker/multi_turn_eval/func_source_code/long_context.py'];
 const [pyodide,sources,docs]=await Promise.all([loadPyodide(),Promise.all(files.map(async f=>{
  const r=await fetch(base+f);if(!r.ok)throw Error('BFCL 파일 로딩 실패: '+f);return [f,await r.text()];
 })),fetch(base+'bfcl_eval/data/multi_turn_func_doc/travel_booking.json').then(r=>{if(!r.ok)throw Error('BFCL 도구 문서 로딩 실패');return r.text();})]);
 pyodide.FS.mkdirTree('/workshop');
 for(const [path,source] of sources){const slash=path.lastIndexOf('/');if(slash>=0)pyodide.FS.mkdirTree('/workshop/'+path.slice(0,slash));pyodide.FS.writeFile('/workshop/'+path,source);}
 pyodide.runPython("import sys\nsys.path.insert(0, '/workshop')\nimport json\nfrom workshop_bridge import WorkshopWorld");
 pyodide.globals.set('_docs_json',JSON.stringify(docs.trim().split('\n').map(JSON.parse)));
 return pyodide;
}
