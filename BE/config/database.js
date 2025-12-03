/**
 * MongoDB 데이터베이스 연결 관리 모듈
 * @module config/database
 * @author joon hyeok
 * @date 2025-07-24
 */



// --- 의존성 require ---
require('dotenv').config();
const mongoose = require('mongoose');


// --- 데이터베이스 연결 설정 ---

// 데이터베이스 연결 상태를 추적하는 플래그
let connectionStatus = false;

// MongoDB host 변수
const hosts = process.env.MONGO_HOSTS;

// MongoDB 연결 URI
const uri = `mongodb://${hosts}/${process.env.MONGO_DATABASE_NAME}?ssl=true&replicaSet=${process.env.MONGO_REPLICA}&authSource=admin&retryWrites=true&w=majority`;


// --- 데이터베이스 연결 ---

/**
 * MongoDB 데이터베이스에 연결합니다.
 * 이미 연결된 경우 기존 연결을 반환하고, 연결되지 않은 경우 새로운 연결을 시도합니다.
 * @async
 * @returns {Promise<typeof mongoose>} Mongoose 객체
 * @throws {Error} 데이터베이스 연결에 실패한 경우
 */
const connectDB = async () => {

    // 싱글톤 - 생성되어 있다면 곧바로 반환
    if(connectionStatus) return mongoose;

    // 싱글톤 - 생성되기 전이라면 생성 후 반환
    try{
        // 실제 MongoDB 연결
        await mongoose.connect(uri, {
            user: process.env.MONGO_USER,
            pass: process.env.MONGO_PASS,
            appName: process.env.MONGO_APP_NAME,
        });

        // 연결됨으로 설정
        connectionStatus = true;
        console.log("✅ MongoDB 연결 성공");

        // DB 연결 객체 반환
        return mongoose;
        
    }catch(error){
        console.error('❌ 연결 실패:', error);
        throw error;
    }
}

// --- 데이터베이스 연결 해제 ---

/**
 * 서버 종료 시 DB 연결을 안전하게 해제합니다.
 * SIGINT 시그널을 받으면 현재 연결 상태를 확인하고 연결을 종료합니다.
 */
process.on('SIGINT', async () => {
    if (connectionStatus) {
        await mongoose.connection.close();
        console.log('MongoDB 연결이 종료되었습니다.');
    }
    process.exit(0);
});


// --- 모듈 export ---

/**
 * 데이터베이스 연결 모듈의 공개 API
 * @exports {Object}
 * @property {Function} connectDB - 데이터베이스 연결 함수
 * @property {Object} mongoose - Mongoose 객체
 * @property {Function} isConnected - 연결 상태 확인 함수
 */
module.exports = {
    connectDB,
    mongoose,
    isConnected: () => connectionStatus,
};
