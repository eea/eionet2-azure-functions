pipeline {
  agent {
            node { label "docker-host" }
  }
  environment {
        GIT_NAME = "eionet2-azure-functions"
        SONARQUBE_TAGS = "eionet2"
        PATH = "${tool 'NodeJS22'}/bin:${tool 'SonarQubeScanner'}/bin:$PATH"
 }
  stages{         


    stage('Release') {
      when {
        allOf {
          environment name: 'CHANGE_ID', value: ''
          branch 'master'
        }
      }
      steps {
          withCredentials([string(credentialsId: 'eea-jenkins-token', variable: 'GITHUB_TOKEN'),string(credentialsId: 'eea-jenkins-npm-token', variable: 'NPM_TOKEN')]) {
            sh '''docker pull eeacms/gitflow'''
            sh '''docker run -i --rm --name="$BUILD_TAG-gitflow-master" -e GIT_BRANCH="$BRANCH_NAME" -e GIT_NAME="$GIT_NAME" -e GIT_TOKEN="$GITHUB_TOKEN" -e NPM_TOKEN="$NPM_TOKEN" -e LANGUAGE=javascript eeacms/gitflow'''
          }
      }
    }
    
	    stage('Tests') {
      when {
        allOf {
          environment name: 'CHANGE_ID', value: ''
          anyOf {
            branch 'master'
            allOf {
              branch 'develop'
              not { changelog '.*^Automated release [0-9\\.]+$' }
            }
          }
        }
	      }
	      steps {
	        script {
	          env.NODEJS_HOME = "${tool 'NodeJS22'}"
	          env.PATH="${env.NODEJS_HOME}/bin:${env.PATH}"
	          env.CI=false
	          sh "npm install --legacy-peer-deps"
	          sh "npm run pc"
	        }
	      }
	    }
    
    stage('Report to SonarQube') {
      when {
        allOf {
          environment name: 'CHANGE_ID', value: ''
          anyOf {
            branch 'master'
            allOf {
              branch 'develop'
              not { changelog '.*^Automated release [0-9\\.]+$' }
            }
          }
        }
      }
      steps {
          script{
            withSonarQubeEnv('Sonarqube') {
              sh "sonar-scanner -Dsonar.javascript.lcov.reportPaths=./coverage/lcov.info -Dsonar.sources=./src  -Dsonar.projectKey=$GIT_NAME -Dsonar.projectName=$GIT_NAME -Dsonar.branch.name=$BRANCH_NAME"
              sh '''try=2; while [ \$try -gt 0 ]; do curl -s -XPOST -u "${SONAR_AUTH_TOKEN}:" "${SONAR_HOST_URL}api/project_tags/set?project=${GIT_NAME}&tags=${SONARQUBE_TAGS}" > set_tags_result; if [ \$(grep -ic error set_tags_result ) -eq 0 ]; then try=0; else cat set_tags_result; echo "... Will retry"; sleep 60; try=\$(( \$try - 1 )); fi; done'''
            }
        }
      }
    }

    stage('Pull Request') {
      when {
        not {
          environment name: 'CHANGE_ID', value: ''
        }
        environment name: 'CHANGE_TARGET', value: 'master'
      }
      steps {
          script {
            if ( env.CHANGE_BRANCH != "develop" ) {
                error "Pipeline aborted due to PR not made from develop branch"
            }
           withCredentials([string(credentialsId: 'eea-jenkins-token', variable: 'GITHUB_TOKEN')]) {
            sh '''docker pull eeacms/gitflow'''
            sh '''docker run -i --rm --name="$BUILD_TAG-gitflow-pr" -e GIT_CHANGE_TARGET="$CHANGE_TARGET" -e GIT_CHANGE_BRANCH="$CHANGE_BRANCH" -e GIT_CHANGE_AUTHOR="$CHANGE_AUTHOR" -e GIT_CHANGE_TITLE="$CHANGE_TITLE" -e GIT_TOKEN="$GITHUB_TOKEN" -e GIT_BRANCH="$BRANCH_NAME" -e GIT_CHANGE_ID="$CHANGE_ID" -e GIT_ORG="$GIT_ORG" -e GIT_NAME="$GIT_NAME" -e LANGUAGE=javascript eeacms/gitflow'''
           }
          }
      }
    }

  }

  
  
  post {
    always {
      cleanWs(cleanWhenAborted: true, cleanWhenFailure: true, cleanWhenNotBuilt: true, cleanWhenSuccess: true, cleanWhenUnstable: true, deleteDirs: true)
    }
    changed {
      script {
        def details = """<h1>${env.JOB_NAME} - Build #${env.BUILD_NUMBER} - ${currentBuild.currentResult}</h1>
                         <p>Check console output at <a href="${env.BUILD_URL}/display/redirect">${env.JOB_BASE_NAME} - #${env.BUILD_NUMBER}</a></p>
                      """
        emailext(
        subject: '$DEFAULT_SUBJECT',
        body: details,
        attachLog: true,
        compressLog: true,
        recipientProviders: [[$class: 'DevelopersRecipientProvider'], [$class: 'CulpritsRecipientProvider']]
        )
      }
    }
  }
}
