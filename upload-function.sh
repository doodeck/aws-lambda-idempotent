#

zip -r tmp/index.zip *.js modules/ node_modules/ ; aws --profile lambda lambda upload-function --region eu-west-1 --function-name invokeidempotent --function-zip tmp/index.zip  --role 'arn:aws:iam::915133436062:role/lambda_exec_role' --mode event --handler invokeidempotent.handler --runtime nodejs --timeout 17
