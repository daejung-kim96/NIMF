# Node.js 18 Ubuntu 베이스 이미지 사용 (wrtc 호환성)
FROM node:18-bullseye-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 도구 설치
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    gcc \
    build-essential \
    git \
    pkg-config \
    libnss3-dev \
    && rm -rf /var/lib/apt/lists/*

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치 (prebuilt wrtc 바이너리 사용)
RUN npm ci --legacy-peer-deps

# 애플리케이션 코드 복사
COPY . .

# Twilio 환경변수 (런타임에 주입됨)
ENV ACCOUNT_SID=""
ENV AUTH_TOKEN=""

# 포트 노출
EXPOSE 5002

# 애플리케이션 실행
CMD ["npm", "start"]
