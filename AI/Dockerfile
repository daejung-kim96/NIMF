# AI 서버 Dockerfile
# FastAPI + WebRTC + 비디오/오디오 처리 서버

# Python 3.10 베이스 이미지 사용
FROM python:3.10-bullseye

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 패키지 설치
RUN apt-get update && apt-get install -y \
    build-essential \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libavutil-dev \
    libx264-dev \
    libopus-dev \
    libssl-dev \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 애플리케이션 소스 코드 복사
COPY . .

# YOLO 설정 디렉토리 생성 (권한 문제 해결)
RUN mkdir -p /tmp/ultralytics && chmod 777 /tmp/ultralytics
ENV YOLO_CONFIG_DIR=/tmp/ultralytics

# YOLO 디바이스 설정 (CPU 사용)
ENV YOLO_DEVICE=cpu

# Twilio 환경변수 (런타임에 주입됨)
ENV ACCOUNT_SID=""
ENV AUTH_TOKEN=""

# 포트 노출 (FastAPI 서버 포트)
EXPOSE 8000

# 애플리케이션 실행
CMD ["python", "main.py"]
