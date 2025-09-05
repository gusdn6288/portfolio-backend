name: portfolio-backend
app:
  name: portfolio-backend
  platform: docker
  
  # 포트 설정
  ports:
    - port: 4000
      protocol: http
  
  # 환경 변수 (실제로는 Cloudtype 대시보드에서 설정)
  envs:
    - key: NODE_ENV
      value: production
    - key: PORT
      value: "4000"
    # 아래 변수들은 Cloudtype 대시보드에서 직접 입력하세요
    # - key: MONGODB_URI
    #   value: ${MONGODB_URI}
    # - key: MONGODB_DB
    #   value: ${MONGODB_DB}  
    # - key: CORS_ORIGIN
    #   value: https://your-vercel-app.vercel.app

  # 리소스 설정 (선택사항)
  resources:
    cpu: 0.25
    memory: 512

  # Auto Scaling 설정 (선택사항)  
  autoscale:
    min: 1
    max: 3
    target_cpu: 70

# 빌드 설정
build:
  context: .
  dockerfile: Dockerfile