// logger.js
// 로그 관련 유틸리티 함수들

/**
 * 콘솔에 로그를 출력하는 함수
 * @param {string} message - 로그 메시지
 * @param {string} type - 로그 타입
 */
export function logToConsole(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}]`;
    
    switch (type) {
        case 'success':
            console.log(`${prefix} ✅ ${message}`);
            break;
        case 'error':
            console.error(`${prefix} ❌ ${message}`);
            break;
        case 'warning':
            console.warn(`${prefix} ⚠️ ${message}`);
            break;
        default:
            console.log(`${prefix} ℹ️ ${message}`);
    }
}

/**
 * 통합 로그 함수 (DOM + 콘솔)
 * @param {string} message - 로그 메시지
 * @param {string} type - 로그 타입
 * @param {string} elementId - DOM 요소 ID
 */
export function log(message, type = 'info') {
    logToConsole(message, type);
}

/**
 * 로그 초기화 함수
 * @param {string} elementId - 초기화할 로그 요소 ID
 */
export function clearLog(elementId = 'log') {
    const logDiv = document.getElementById(elementId);
    if (logDiv) {
        logDiv.innerHTML = '';
    }
} 