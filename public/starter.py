"""BFCL 여행 업무 에이전트 · Python 설치 없이 브라우저에서 실행합니다.
agent(task, api)는 사용자 턴마다 호출됩니다.
이 파일의 전역 변수는 같은 케이스 안에서 유지되고 다음 케이스에서 초기화됩니다.
api.tools는 매 턴 갱신됩니다. 실제 카드/예약/결제는 전혀 발생하지 않습니다.
"""
import json

SYSTEM = """You are a travel assistant working in a simulated tool environment.
Complete the current user request using only the currently available tools.
Use previous conversation and tool results to resolve follow-up references.
Never invent missing required information. If essential information or a required
function is missing, ask for it and make NO tool calls in that turn.
Do not repeat a successful state-changing operation. Report tool errors honestly.
After completing the requested actions, answer the user and end the turn.
"""
history = [{"role": "system", "content": SYSTEM}]

async def agent(task, api):
    history.extend(task["messages"])
    for _ in range(8):
        reply = await api.chat(history, api.tools)
        history.append(reply)
        calls = reply.get("tool_calls") or []
        if not calls:
            return reply.get("content") or ""
        for call in calls:
            name = call["function"]["name"]
            try:
                arguments = json.loads(call["function"].get("arguments") or "{}")
                result = await api.tool(name, arguments)
            except (ValueError, TypeError) as error:
                result = {"error": str(error)}
            history.append({"role": "tool", "tool_call_id": call["id"],
                            "content": json.dumps(result, ensure_ascii=False)})
    # The runner enforces the common call budget even if submitted code changes this loop.
    return "Step limit reached."
