# Node.js 18 Alpine 이미지를 베이스로 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사 (의존성 캐싱을 위해)
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 애플리케이션 사용자 생성 (보안을 위해)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 파일 소유권 변경
RUN chown -R nodejs:nodejs /app
USER nodejs

# 포트 노출
EXPOSE 3000


# 애플리케이션 시작
CMD ["npm", "start"]
