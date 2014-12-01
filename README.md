aws-lambda-idempotent
=====================

Library to call AWS Lambda functions preventing duplicate execution

A somewhat controversial, albeit aboslutely legitimate use case for AWS Lambda function is recursion.

Applications include e.g. multiple scaling of the images or installing bots in the cloud, performing operations at regulat intervals.

In either case, since Lambda fuctions are so perfectly cloud resident and detached from the physical world it's possible that you lose track of what is running in the background. It may be due to mistaken invocation or some bug in the recursive code, you may end up with hundreds of lanbda functions sucking the precious second-GB from you free tier and later from the CC.

The library is preventing that using the DynamoDB. A recursive Lambda fuction is called an instance. There can be only one instance running at the same time, The accompanying DynamoDB record is keping track of that by conditionally incrementing a counter. Should a function be executed mistakenly, it will not be able to increment the record and will terminat without spinning off a recursive descendant.
