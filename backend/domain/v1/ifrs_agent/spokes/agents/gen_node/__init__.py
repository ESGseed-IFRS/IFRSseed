"""
Gen Node - SR 보고서 문단 생성

Phase 2에서 필터링된 데이터(gen_input)를 받아 IFRS/GRI/ESRS 스타일의 SR 문단 생성
"""
from .agent import GenNodeAgent, make_gen_node_handler

__all__ = ["GenNodeAgent", "make_gen_node_handler"]
