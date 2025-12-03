# Node.js 18 Alpine 이미지를 베이스로 사용
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사 (의존성 캐싱을 위해)
COPY package*.json ./

# 모든 의존성 설치 (개발 의존성 포함)
RUN npm ci

# 소스 코드 복사
COPY . .

# 프로덕션 빌드
RUN npm run build

# nginx 이미지를 베이스로 사용
FROM nginx:alpine

# nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/nginx.conf

# SSL 디렉토리 생성
RUN mkdir -p /etc/nginx/ssl

# 빌드된 파일을 nginx의 기본 디렉토리로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 포트 노출
EXPOSE 80

# nginx 시작
CMD ["nginx", "-g", "daemon off;"]
