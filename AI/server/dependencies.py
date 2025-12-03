"""
의존성 주입 모듈
@module dependencies
@author joon hyeok
@date 2025-07-29
@description FastAPI 의존성 주입을 위한 모듈로, ConnectionManager 인스턴스를 제공합니다.
"""

import sys
import os

# 현재 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from connection_manager import ConnectionManager

def get_connection_manager():
    """
    ConnectionManager 싱글톤 인스턴스를 반환합니다.
    
    @function get_connection_manager
    @returns {ConnectionManager} ConnectionManager 인스턴스
    """
    return ConnectionManager()
