"""Workshop transport adapter; upstream environment and checkers are unmodified."""
import json
import re
from copy import deepcopy
from bfcl_eval.eval_checker.multi_turn_eval import multi_turn_utils as execution
from bfcl_eval.eval_checker.multi_turn_eval.multi_turn_checker import multi_turn_checker, multi_turn_irrelevance_checker

def normalize_schema(value):
    if isinstance(value, list):
        return [normalize_schema(x) for x in value]
    if not isinstance(value, dict):
        return value
    result = {k: normalize_schema(v) for k, v in value.items()}
    mapping = {"dict": "object", "float": "number", "int": "integer", "bool": "boolean", "list": "array", "tuple": "array"}
    if isinstance(result.get("type"), str):
        result["type"] = mapping.get(result["type"], result["type"])
    return result

def clear_instances():
    for key in list(vars(execution)):
        if key.endswith("_instance"):
            delattr(execution, key)

class WorkshopWorld:
    def __init__(self, test, docs):
        clear_instances()
        self.test = deepcopy(test)
        self.entry = self.test["entry"]
        self.docs = docs
        self.turn = 0
        self.calls = [[]]
        self.answers = []
        self.long_context = "long_context" in self.entry["id"]

    def tool_names(self):
        withheld = {name for turn, names in self.entry.get("missed_function", {}).items() if int(turn) > self.turn for name in names}
        return {doc["name"] for doc in self.docs} - withheld - set(self.entry.get("excluded_function", []))

    def setup(self):
        questions = self.entry["question"][self.turn]
        if not questions and str(self.turn) in self.entry.get("missed_function", {}):
            questions = [{"role": "user", "content": "I have updated some more functions you can choose from. What about now?"}]
        message = "\n".join(x["content"] for x in questions)
        tools = [{"type": "function", "function": {"name": d["name"], "description": d["description"] + "\nReturns: " + json.dumps(d.get("response", {})), "parameters": normalize_schema(d["parameters"])}} for d in self.docs if d["name"] in self.tool_names()]
        return {"task": {"message": message, "messages": questions, "turn": self.turn, "turns": len(self.entry["question"])}, "tools": tools, "turns": len(self.entry["question"])}

    def tool(self, name, args):
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", name):
            raise ValueError("Invalid tool name")
        if not isinstance(args, dict) or any(not isinstance(k, str) for k in args):
            raise ValueError("Tool arguments must be a JSON object")
        # Only literals from JSON arguments reach the original expression runner.
        expression = f"{name}(**{args!r})"
        if name not in self.tool_names():
            self.calls[self.turn].append(["workshop_unavailable_tool()"])
            return {"error": f"Tool {name} is not available in this turn"}
        self.calls[self.turn].append([expression])
        results, _ = execution.execute_multi_turn_func_call([expression], self.entry["initial_config"], ["TravelAPI"], "workshop_live", self.entry["id"], self.long_context)
        try:
            return json.loads(results[0])
        except (ValueError, TypeError):
            return results[0]

    def next(self, answer):
        self.answers.append(answer)
        self.turn += 1
        self.calls.append([])
        return self.setup()

    def grade(self, answer):
        self.answers.append(answer)
        checks = []
        all_valid = True
        # Prefix replay supplies diagnostics using the unchanged official checks.
        for end in range(1, len(self.calls) + 1):
            clear_instances()
            calls = [step or [[]] for step in self.calls[:end]]
            truth = self.test["ground_truth"][:end]
            result = multi_turn_checker(calls, truth, self.entry, self.entry["id"].rsplit("_", 1)[0], "workshop")
            irrelevant = multi_turn_irrelevance_checker(calls, truth)
            valid = result["valid"] and irrelevant["valid"]
            all_valid = all_valid and valid
            checks.append({"label": f"{end}턴까지 상태·도구 결과·호출 보류 검사", "pass": valid, "error": None if valid else (result if not result["valid"] else irrelevant).get("error_type")})
        return {"passed": all_valid and len(self.calls) == len(self.entry["question"]), "checks": checks, "answers": self.answers}
