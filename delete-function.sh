#

aws --profile lambda lambda delete-function --region eu-west-1 \
  --function-name invokeidempotent
