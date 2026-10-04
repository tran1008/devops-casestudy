pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
metadata:
  labels:
    component: ci
spec:
  containers:
  - name: nodejs
    image: node:20-alpine
    command:
    - cat
    tty: true
  - name: kaniko
    image: gcr.io/kaniko-project/executor:v1.23.0-debug
    command:
    - sleep
    args:
    - 9999999
  - name: kubectl
    image: bitnami/kubectl:1.35
    command:
    - cat
    tty: true
'''
        }
    }

    options {
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    environment {
        APP_NAME    = 'demo-app'
        REGISTRY    = 'hub.fci.vn'
        PROJECT     = 'cso-monitoring'
        IMAGE_TAG   = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7)}"
        IMAGE_FULL  = "${REGISTRY}/${PROJECT}/${APP_NAME}:${IMAGE_TAG}"
        SONAR_TOKEN = credentials('sonar-token')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build, Test & Quality') {
            parallel {
                stage('Unit Test') {
                    steps {
                        container('nodejs') {
                            dir('app') {
                                sh 'npm install'
                                sh 'npm test -- --ci'
                            }
                        }
                    }
                }
                stage('SonarQube Scan') {
                    steps {
                        container('nodejs') {
                            dir('app') {
                                sh 'npm install'
                                sh """
                                  npx sonar-scanner \\
                                    -Dsonar.projectKey=${APP_NAME} \\
                                    -Dsonar.host.url=http://sonarqube-sonarqube.sonarqube.svc.cluster.local:9000 \\
                                    -Dsonar.login=${SONAR_TOKEN}
                                """
                            }
                        }
                    }
                }
            }
        }

        stage('Build & Push Image') {
            steps {
                container('kaniko') {
                    withCredentials([usernamePassword(credentialsId: 'harbor-robot', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                        sh """
                          mkdir -p /kaniko/.docker
                          echo '{"auths":{"'${REGISTRY}'":{"username":"'${REG_USER}'","password":"'${REG_PASS}'"}}}' > /kaniko/.docker/config.json
                          /kaniko/executor \\
                            --context=${WORKSPACE}/app \\
                            --dockerfile=${WORKSPACE}/app/Dockerfile \\
                            --destination=${IMAGE_FULL} \\
                            --insecure \\
                            --insecure-registry=${REGISTRY}
                        """
                    }
                }
            }
        }

        stage('Deploy to K8s') {
            steps {
                container('kubectl') {
                    sh """
                      kubectl -n demo-app set image deployment/demo-app \\
                        demo-app=${IMAGE_FULL}
                      kubectl -n demo-app rollout status deployment/demo-app --timeout=3m
                    """
                }
            }
        }

        stage('Smoke Test') {
            steps {
                container('nodejs') {
                    sh '''
                      for i in \$(seq 1 10); do
                        if wget -qO- http://demo-app.demo-app.svc.cluster.local/health; then
                          echo "Healthcheck OK"; exit 0
                        fi
                        sleep 5
                      done
                      echo "Healthcheck FAILED"; exit 1
                    '''
                }
            }
        }
    }

    post {
        failure {
            echo "Pipeline FAILED! Check logs at ${BUILD_URL}"
        }
        success {
            echo "✅ ${APP_NAME}:${IMAGE_TAG} deployed successfully!"
        }
        always {
            cleanWs()
        }
    }
}
