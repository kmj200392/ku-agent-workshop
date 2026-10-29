"""Ground-truth parity and negative checks; no model calls."""
import ast
import hashlib
import inspect
import json
import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'public/benchmarks/bfcl'
sys.path.insert(0, str(VENDOR))
from workshop_bridge import WorkshopWorld
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.travel_booking import TravelAPI
SUITES = json.loads((ROOT / 'lib/bfcl-suites.json').read_text())
DOCS = [json.loads(l) for l in (VENDOR / 'bfcl_eval/data/multi_turn_func_doc/travel_booking.json').read_text().splitlines()]

def call_args(expression):
    node = ast.parse(expression, mode='eval').body
    args = [ast.literal_eval(x) for x in node.args]
    kwargs = {x.arg: ast.literal_eval(x.value) for x in node.keywords}
    bound = inspect.signature(getattr(TravelAPI, node.func.id)).bind(None, *args, **kwargs)
    return node.func.id, {k:v for k,v in bound.arguments.items() if k != 'self'}

def oracle(test):
    return [[dict(zip(['name', 'arguments'], call_args(expr))) for expr in turn] for turn in test['ground_truth']]

def replay(test, transform=None):
    world = WorkshopWorld(test, DOCS)
    for i, turn in enumerate(oracle(test)):
        if i: world.next('done')
        for call in turn:
            name, args = call['name'], call['arguments']
            if transform: name,args = transform(i,name,args)
            world.tool(name,args)
    return world.grade('done')

class BFCLTests(unittest.TestCase):
    def test_original_ground_truth_passes_every_selected_case(self):
        for split, tests in SUITES.items():
            for item in tests:
                with self.subTest(split=split,id=item['id']):
                    result=replay(item)
                    self.assertTrue(result['passed'], result)
    def test_split_has_no_shared_family_or_problem_id(self):
        self.assertEqual([len(SUITES[x]) for x in ['practice','final']],[12,30])
        self.assertFalse({x['family'] for x in SUITES['practice']} & {x['family'] for x in SUITES['final']})
        self.assertFalse({'153','159','164','179'} & {x['family'] for ts in SUITES.values() for x in ts})
    def test_doing_nothing_does_not_pass(self):
        for item in SUITES['practice']+SUITES['final']:
            w=WorkshopWorld(item,DOCS)
            for _ in range(len(item['ground_truth'])-1):w.next('I completed it')
            self.assertFalse(w.grade('I completed it')['passed'])
    def test_wrong_budget_fails(self):
        def change(turn,name,args):
            if name=='set_budget_limit':args={**args,'budget_limit':1}
            return name,args
        self.assertFalse(replay(SUITES['practice'][0],change)['passed'])
    def test_original_abstention_rule(self):
        item=SUITES['practice'][1]
        w=WorkshopWorld(item,DOCS)
        for i,turn in enumerate(oracle(item)):
            if i:w.next('done')
            for call in turn:w.tool(call['name'],call['arguments'])
            if not turn:w.tool('list_all_airports',{})
        self.assertFalse(w.grade('done')['passed'])
    def test_missing_tool_restoration_and_no_answer_leak(self):
        item=SUITES['practice'][2];w=WorkshopWorld(item,DOCS)
        for i in range(len(item['ground_truth'])):
            setup=w.setup() if i==0 else w.next('done')
            names={x['function']['name'] for x in setup['tools']}
            self.assertNotIn('ground_truth',setup['task'])
            self.assertNotIn('initial_config',setup['task'])
            for turn, missing in item['entry']['missed_function'].items():
                for name in missing:self.assertEqual(name in names,i>=int(turn))
            if str(i) in item['entry'].get('missed_function',{}):
                self.assertEqual(setup['task']['message'],'I have updated some more functions you can choose from. What about now?')
    def test_vendor_checksums_unchanged(self):
        manifest=json.loads((VENDOR/'manifest.json').read_text())
        for rel,digest in manifest['upstreamFileHashes'].items():
            self.assertEqual(hashlib.sha256((VENDOR/rel).read_bytes()).hexdigest(),digest,rel)
    def test_repeated_runs_start_from_fresh_state(self):
        for _ in range(2):self.assertTrue(replay(SUITES['practice'][3])['passed'])
    def test_every_authored_case_requires_its_final_reference_action(self):
        for item in SUITES['practice']+SUITES['final']:
            if item['provenance']['kind']!='authored':continue
            with self.subTest(id=item['id']):
                plan=oracle(item)
                final_action=max(i for i,turn in enumerate(plan) if turn)
                plan[final_action]=plan[final_action][:-1]
                w=WorkshopWorld(item,DOCS)
                for i,turn in enumerate(plan):
                    if i:w.next('done')
                    for c in turn:w.tool(c['name'],c['arguments'])
                self.assertFalse(w.grade('done')['passed'])
    def test_abstention_turns_reject_unrelated_lookup_in_every_case(self):
        for item in SUITES['practice']+SUITES['final']:
            if not any(not turn for turn in item['ground_truth']):continue
            with self.subTest(id=item['id']):
                w=WorkshopWorld(item,DOCS)
                for i,turn in enumerate(oracle(item)):
                    if i:w.next('done')
                    for c in turn:w.tool(c['name'],c['arguments'])
                    if not turn:w.tool('list_all_airports',{})
                self.assertFalse(w.grade('done')['passed'])
    def test_wrong_booking_reference_is_rejected(self):
        for number in ['1103','2106','2107']:
            item=next(c for cases in SUITES.values() for c in cases if c['family']==number)
            def mutate(turn,name,args):
                if name=='cancel_booking':args={**args,'booking_id':'nonexistent-booking'}
                return name,args
            self.assertFalse(replay(item,mutate)['passed'])
    def test_tool_transport_accepts_only_literal_named_calls(self):
        w=WorkshopWorld(SUITES['practice'][0],DOCS)
        with self.assertRaises(ValueError):w.tool('__import__',{})
        self.assertIn('error',w.tool('unavailable',{}))
        self.assertIn('error',w.tool('set_budget_limit',{'access_token':"'); __import__('os'); #",'budget_limit':100}))

if __name__=='__main__':unittest.main()
