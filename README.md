aws-lambda-idempotent
=====================

An Internet daemon running tirelessly in the cloud doing any useful work of you choice.

The library is calling AWS Lambda functions preventing duplicate execution.

The reasoning
-------------

A somewhat controversial, albeit absolutely legitimate use case for AWS Lambda functions is recursion. It's very important to prevent multiple deamon instances spinning out of control though.

Lambda fuctions are so perfectly cloud resident and detached from the physical world, that it's possible to lose track of what is running in the background. As a result of mistaken invocation or some bug in the recursive code, you may end up with tens of lambda functions sucking the precious second-GBs from you free tier and later from your credit card.

The library is preventing that using the DynamoDB. A recursive Lambda fuction is called an instance. There can be only one instance running at the same time, The accompanying DynamoDB record is keeping track of that by conditionally incrementing a singleton counter. Should a function be executed mistakenly, it will not be able to increment the record and will terminate without spinning off a recursive descendant.

Use cases
---------
Imaginable applications include e.g.

* multiple scaling of the images,
* installing bots in the cloud, performing operations at regular intervals, e.g.
  + scraping the content off the web, putting it into databases
  + status reporting to Twitter, Facebook, etc.


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
  <li>In the Lambda console change the advanced settings of the function, change the timeout to 1 second, the next invocation with be prematurely interrupted, or</li>
  <li>In the DynamoDB console edit the reord and modify the Seq field to break the incremental sequence</li>
  <li>... or the brute force approach of deleting the Lambda function.</li>
</ul>

The Payload
-----------
You can hook any useful content in the modules/payload.js folder. Intertingly, the payload function can work after the Lambda invocation has officially finished by calling `context.done()`. You are billed only for the execution until `context.done()`, after that the payload function keeps running much longer, even 15 minutes. You can test it with the sample payload, which is an infinite loop running for as long as possible.

