pipeline {
    agent any
    options { skipDefaultCheckout(true) }

    environment {        
        // Git 관련
        GIT_REPO = credentials('gitlab-repo-url')
        // GIT_BRANCH = 'master'
        GIT_BRANCH = 'test/ec2-deploy'
        
        // Docker 이미지 이름
        BE_IMAGE = 'backend-app'
        FE_IMAGE = 'frontend-app'
        AI_IMAGE = 'ai-server-app'
        STREAMING_IMAGE = 'streaming-server-app'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        
        // 포트 설정
        BE_PORT = '3000'
        FE_PORT = '3001'
        AI_PORT = '8000'
        STREAMING_PORT = '5002'


        // MongoDB 환경변수
        MONGO_HOSTS = credentials('mongo-hosts')
        MONGO_DATABASE_NAME = credentials('mongo-database')
        MONGO_REPLICA = credentials('mongo-replica')
        MONGO_USER = credentials('mongo-user')
        MONGO_PASS = credentials('mongo-password')
        MONGO_APP_NAME = credentials('mongo-app-name')

        // OAuth 환경변수
        GOOGLE_LOGIN_ENDPOINT = credentials('GOOGLE_LOGIN_ENDPOINT')
        GOOGLE_CLIENT_ID = credentials('GOOGLE_CLIENT_ID')
        GOOGLE_CLIENT_SECRET = credentials('GOOGLE_CLIENT_SECRET')
        REDIRECT_URI = credentials('REDIRECT_URI')

        // URL 환경변수
        SERVER_BASE_URL = credentials('SERVER_BASE_URL')	
        CLIENT_BASE_URL = credentials('CLIENT_BASE_URL')
        VITE_API_BASE_URL = credentials('VITE_API_BASE_URL')
        VITE_AI_BASE_URL = credentials('VITE_AI_BASE_URL')

        // Twilio 환경변수
        ACCOUNT_SID = credentials('ACCOUNT_SID')
        AUTH_TOKEN = credentials('AUTH_TOKEN')

        // 기타 환경변수
        JWT_SECRET = credentials('jwt-secret')
        VITE_TEST_KEY = credentials('VITE_TEST_KEY')
    }
    
    stages {
        stage('Checkout') {
            steps {
                // Git LFS를 포함한 코드 체크아웃
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "${GIT_BRANCH}"]],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [
                        [$class: 'GitLFSPull'],
                        [$class: 'CleanBeforeCheckout'],
                        [$class: 'CleanCheckout']
                    ],
                    submoduleCfg: [],
                    userRemoteConfigs: [[
                        credentialsId: 'gitlab_token_username_with_password',
                        url: "${GIT_REPO}"
                    ]]
                ])
                
                // Git LFS 초기화 및 파일 pull
                sh '''
                    # Git LFS 설치 시도 (오류 무시하고 계속 진행)
                    echo "Git LFS 설치 시도..."
                    git lfs install --skip-smudge 2>/dev/null || echo "LFS install 실패, 계속 진행..."
                    
                    # LFS 파일 pull 시도
                    echo "Git LFS pull 시도..."
                    git lfs pull 2>/dev/null || echo "LFS pull 실패, 계속 진행..."
                    
                    # LFS 파일 확인
                    echo "=== LFS 파일 목록 ==="
                    git lfs ls-files 2>/dev/null | head -20 || echo "LFS 파일 목록 조회 실패"
                    
                    # 전체 파일 크기 확인
                    echo "=== 전체 파일 크기 확인 ==="
                    du -sh .
                    
                    # AI 모델 파일들이 있는지 확인
                    echo "=== AI 모델 파일 확인 ==="
                    find . -name "*.onnx" -o -name "*.pt" -o -name "*.pth" 2>/dev/null | head -10 || echo "AI 모델 파일을 찾을 수 없습니다"
                    
                    # 디렉토리 구조 확인
                    echo "=== 디렉토리 구조 확인 ==="
                    ls -la
                    echo "=== AI 디렉토리 확인 ==="
                    ls -la AI/ 2>/dev/null || echo "AI 디렉토리가 없습니다"
                '''
            }
        }
        
        stage('Build Backend') {
            steps {
                dir('BE') {
                    // 백엔드 Docker 이미지 빌드
                    sh "docker build -t ${BE_IMAGE}:${DOCKER_TAG} ."
                    sh "docker tag ${BE_IMAGE}:${DOCKER_TAG} ${BE_IMAGE}:latest"
                    
                    // 이미지 크기 확인
                    sh "docker images ${BE_IMAGE}:${DOCKER_TAG}"
                }
            }
        }
        
        stage('Build Frontend') {
            steps {
                dir('FE') {
                    // .env.production 파일 생성
                    sh """
                        echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" > .env.production
                        echo "VITE_AI_BASE_URL=https://www.nimf.shop" >> .env.production
                        echo "VITE_TEST_KEY=${VITE_TEST_KEY}" >> .env.production
                    """
                    
                    // 프론트엔드 Docker 이미지 빌드
                    sh "docker build -t ${FE_IMAGE}:${DOCKER_TAG} ."
                    sh "docker tag ${FE_IMAGE}:${DOCKER_TAG} ${FE_IMAGE}:latest"
                    
                    // 이미지 크기 확인
                    sh "docker images ${FE_IMAGE}:${DOCKER_TAG}"
                }
            }
        }

        stage('Build ai-server'){
            steps {
                dir('AI'){
                    // AI 서버 Docker 이미지 빌드
                    sh "docker build -t ${AI_IMAGE}:${DOCKER_TAG} ."
                    sh "docker tag ${AI_IMAGE}:${DOCKER_TAG} ${AI_IMAGE}:latest"
                    
                    // 이미지 크기 확인
                    sh "docker images ${AI_IMAGE}:${DOCKER_TAG}"
                }
            }
        }

        stage('Build streaming-server'){
            steps{
                dir('streaming-server'){
                    // STREAMING 서버 Docker 이미지 빌드 (캐시 없이 강제 리빌드)
                    sh "docker build --no-cache -t ${STREAMING_IMAGE}:${DOCKER_TAG} ."
                    sh "docker tag ${STREAMING_IMAGE}:${DOCKER_TAG} ${STREAMING_IMAGE}:latest"
                    
                    // 이미지 크기 확인
                    sh "docker images ${STREAMING_IMAGE}:${DOCKER_TAG}"
                }
            }
        }
        
        stage('Deploy') {
            steps {
                script {
                    // 같은 서버에서 직접 컨테이너 배포
                    sh """
                        # 기존 컨테이너 중지 및 제거
                        docker stop backend frontend ai-server streaming-server || true
                        docker rm backend frontend ai-server streaming-server || true

                        # Docker 네트워크 생성 (이미 존재하면 무시)
                        docker network create app-network || true
                        
                        # 백엔드 컨테이너 시작
                        docker run -d \\
                            --name backend \\
                            --network app-network \\
                            --restart unless-stopped \\
                            -p ${BE_PORT}:${BE_PORT} \\
                            -e PORT=${BE_PORT} \\
                            -e MONGO_HOSTS="\$MONGO_HOSTS" \\
                            -e MONGO_DATABASE_NAME="\$MONGO_DATABASE_NAME" \\
                            -e MONGO_REPLICA="\$MONGO_REPLICA" \\
                            -e MONGO_USER="\$MONGO_USER" \\
                            -e MONGO_PASS="\$MONGO_PASS" \\
                            -e MONGO_APP_NAME="\$MONGO_APP_NAME" \\
                            -e JWT_SECRET="\$JWT_SECRET" \\
                            -e GOOGLE_LOGIN_ENDPOINT="\$GOOGLE_LOGIN_ENDPOINT" \\
                            -e GOOGLE_CLIENT_ID="\$GOOGLE_CLIENT_ID" \\
                            -e GOOGLE_CLIENT_SECRET="\$GOOGLE_CLIENT_SECRET" \\
                            -e REDIRECT_URI="\$REDIRECT_URI" \\
                            -e SERVER_BASE_URL="\$SERVER_BASE_URL" \\
                            -e CLIENT_BASE_URL="\$CLIENT_BASE_URL" \\
                            -e AI_BASE_URL="ws://ai-server:8000/ws" \\
                            -e ACCOUNT_SID="\$ACCOUNT_SID" \\
                            -e AUTH_TOKEN="\$AUTH_TOKEN" \\
                            -e YOUTUBE_REDIRECT_URI="https://www.nimf.shop/api/auth/youtube/callback" \\
                            ${BE_IMAGE}:${DOCKER_TAG}
                        
                        # 프론트엔드 컨테이너 시작
                        docker run -d \\
                            --name frontend \\
                            --network app-network \\
                            --restart unless-stopped \\
                            -p ${FE_PORT}:80 \\
                            ${FE_IMAGE}:${DOCKER_TAG}

                        # AI 컨테이너 시작
                        docker run -d \\
                            --name ai-server \\
                            --network app-network \\
                            --restart unless-stopped \\
                            -p ${AI_PORT}:${AI_PORT} \\
                            -e STREAMING_SERVER_URL="http://streaming-server:5002" \\
                            ${AI_IMAGE}:${DOCKER_TAG}

                        # STREAMING 컨테이너 시작
                        docker run -d \\
                            --name streaming-server \\
                            --network app-network \\
                            --restart unless-stopped \\
                            -p ${STREAMING_PORT}:${STREAMING_PORT} \\
                            -e PORT=${STREAMING_PORT} \\
                            -e NODE_ENV=production \\
                            -e AI_ORIGIN="http://ai-server:8000" \\
                            ${STREAMING_IMAGE}:${DOCKER_TAG}

                        # 네트워크 상태 확인
                        docker network ls
                        docker network inspect app-network || true
                        
                        # 오래된 이미지 정리
                        docker image prune -f
                        
                        # 컨테이너 상태 확인
                        docker ps
                    """
                }
            }
        }
    }
    
    post {
        always {
            // 워크스페이스 정리 (디스크 공간 절약)
            cleanWs()
            // Docker 이미지 정리 (디스크 공간 절약)
            sh "docker image prune -f || true"
        }
    }
} 