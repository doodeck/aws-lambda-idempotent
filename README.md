aws-lambda-idempotent
=====================

Library to call AWS Lambda functions preventing duplicate execution

A somewhat controversial, albeit absolutely legitimate use case for AWS Lambda functions is recursion.

Imaginable applications include e.g. multiple scaling of the images or installing bots in the cloud, performing operations at regular intervals.

In either case, since Lambda fuctions are so perfectly cloud resident and detached from the physical world, it's possible that you lose track of what is running in the background. As a result of mistaken invocation or some bug in the recursive code, you may end up with hundreds of lambda functions sucking the precious second-GBs from you free tier and later from your CC.

The library is preventing that using the DynamoDB. A recursive Lambda fuction is called an instance. There can be only one instance running at the same time, The accompanying DynamoDB record is keeping track of that by conditionally incrementing a singleton counter. Should a function be executed mistakenly, it will not be able to increment the record and will terminate without spinning off a recursive descendant.

Getting Started
---------------

Using the AWS Console create a new HelloWorld project following that tutorial, you can name your function "invokeIdempotent", then you don't need to rename the sources:

http://docs.aws.amazon.com/lambda/latest/dg/getting-started.html

Set memory to 128MB, execution time to 16 seconds. Set the handler name to "invokeidempotent" (without quotes).

Follow only the 2 tutorials using AWS Console, i.e. Getting Started 1 & 2, you don't need to continue to CLI.

Edit the default execution role (lambda_exec_role) to add DynamoDB and Lambda access capabilities. It should look similar to this, which is even slightly more permissive:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:*",
        "dynamodb:*",
        "iam:PassRole",
        "lambda:*",
        "logs:*",
        "s3:*"
      ],
      "Resource": "*"
    }
  ]
}
```

Create the DynamoDB table with Table Name "LambdaLocks", Primary Hash Key called "FunctionName", of type String, and Primary Range Key called "InstanceId", also String. You can find the complete JSON dump of such a table in the index.js. Add a single item to that table:

```json
{
  "FunctionName": {
    "S": "invokeidempotent"
  },
  "InstanceId": {
    "S": "Grp1"
  },
  "Seq": {
    "N": "1"
  }
}
```

Now open Lambda (Preview) in the AWS console. Edit/Test the function you created. Copy/Paste the whole content of index.js file completely replacing the HelloWorld content. In the Sample Event field enter the following event:

```json
{
    "InstanceId": "Grp1",
    "ExpectedSeq": 1
}
```
Click "Save and invoke"

The function should start calling itself recursively every 5 seconds. The DynamoDB record should get incremented in the process. Also, there are corresponding logs written to the Amazon CloudWatch. Do not be confused, the Lambda console will only show the first invocation of the function, the subsequent recursive calls are happening in the background, leaving the trails in the CloudWatch and incrementing the DynamoDB record.

If you want to terminate the function you can carry out any of these operations:

<ul>
  <li>In the Lambda consle change the advanced settings of the function, change the timeout to 1 second, the next invocation with be prematurely interrupted, or</li>
  <li>In the DynamoDB console edit the reord and modify the Seq field to break the incremental sequence</li>
  <li>... or the brute force approach of deleteing the Lambda function.</li>
</ul>
