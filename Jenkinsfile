// InsecureShield pipeline lab — Jenkins declarative pipeline.
// Mirrors the GitHub Actions pipeline on a second CI engine to show the
// shift-left blind spot is CI-engine-agnostic: the same clean source passes
// the secret-scan gate on Jenkins too, and the same build ships the secret.
//
// Requires a Jenkins "Secret text" credential with id 'dotenv' holding the
// full .env contents (path P3 — the CI secret store).

pipeline {
    agent any

    environment {
        GITLEAKS_VERSION   = '8.30.1'
        TRUFFLEHOG_VERSION = '3.99.7'
    }

    stages {
        stage('Shift-left secret scan (gate)') {
            steps {
                sh '''
                    curl -sSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
                      | tar -xz -C . gitleaks
                    ./gitleaks version
                    # fails the build on ANY finding in source/history — clean source passes green
                    ./gitleaks git . --no-banner --redact --exit-code 1
                '''
            }
        }

        stage('Build (injects secret — P3 to P4)') {
            steps {
                withCredentials([string(credentialsId: 'dotenv', variable: 'DOTENV')]) {
                    sh '''
                        printf '%s\\n' "$DOTENV" > .env
                        npm ci
                        npm run build
                        echo "Stripe key grepped straight out of the compiled bundle:"
                        grep -oE 'sk_live_[A-Za-z0-9]+' dist/js/*.js | head -1
                    '''
                }
            }
        }

        stage('Deploy (stand up the app — P5 to P7)') {
            steps {
                withCredentials([string(credentialsId: 'dotenv', variable: 'DOTENV')]) {
                    sh '''
                        docker build --build-arg DOTENV="$DOTENV" -t insecureshield-portal:${BUILD_NUMBER} .
                        docker rm -f portal 2>/dev/null || true
                        docker run -d -p 3200:3200 --name portal insecureshield-portal:${BUILD_NUMBER}
                        sleep 4
                        echo "GET /config.json from the deployed app:"
                        curl -s http://localhost:3200/config.json | grep -E 'client_secret|subscriptionKey' || true
                        docker rm -f portal || true
                    '''
                }
            }
        }

        stage('Artifact audit (instrumentation, non-blocking)') {
            steps {
                sh '''
                    echo "The same scanner that saw nothing in source now sees the shipped secrets:"
                    ./gitleaks dir dist --no-banner --redact --exit-code 1 || echo "WARNING: secrets present in build artifact"
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'dist/**', allowEmptyArchive: true
        }
    }
}
