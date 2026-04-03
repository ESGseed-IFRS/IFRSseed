"""Hub-and-Spoke 아키텍처

Hub: 중앙 조율 센터
- orchestrator: 워크플로우 판단 및 제어
- routing: Agent/Service 호출 중재

Spokes: 실행 주체
- agents: 실제 에이전트 구현
- infra: MCP, Tool, PDF 파싱 등 인프라
"""
