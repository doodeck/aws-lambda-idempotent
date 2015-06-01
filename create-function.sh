#

mkdir -p tmp
zip -r tmp/index.zip invokeidempotent/*.js invokeidempotent/modules/ node_modules/
aws --profile lambda lambda create-function --region eu-west-1 \
  --function-name invokeidempotent \
  --runtime nodejs \
  --role 'arn:aws:iam::915133436062:role/lambda_exec_role' \
  --handler 'invokeidempotent/invokeidempotent.handler' \
  --timeout 16 \
  --memory-size 128 \
  --zip-file fileb://tmp/index.zip
