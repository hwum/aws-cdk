import * as path from 'path';
import { Template } from '../../assertions';
import * as sfn from '../../aws-stepfunctions';
import * as cdk from '../../core';
import * as appsync from '../lib';

// GLOBAL GIVEN
let stack: cdk.Stack;
let api: appsync.GraphqlApi;
let endpoint: string;
beforeEach(() => {
  stack = new cdk.Stack();
  api = new appsync.GraphqlApi(stack, 'baseApi', {
    name: 'api',
    schema: appsync.SchemaFile.fromAsset(path.join(__dirname, 'appsync.test.graphql')),
  });
  endpoint = 'aws.amazon.com';
});

describe('Http Data Source configuration', () => {
  test('default configuration produces name `HttpCDKDataSource`', () => {
    // WHEN
    api.addHttpDataSource('ds', endpoint);

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'HTTP',
      Name: 'ds',
    });
  });

  test('appsync configures name correctly', () => {
    // WHEN
    api.addHttpDataSource('ds', endpoint, {
      name: 'custom',
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'HTTP',
      Name: 'custom',
    });
  });

  test('appsync configures name and description correctly', () => {
    // WHEN
    api.addHttpDataSource('ds', endpoint, {
      name: 'custom',
      description: 'custom description',
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'HTTP',
      Name: 'custom',
      Description: 'custom description',
    });
  });

  test('appsync configures name, authorizationConfig correctly', () => {
    // WHEN
    api.addHttpDataSource('ds', endpoint, {
      name: 'custom',
      description: 'custom description',
      authorizationConfig: {
        signingRegion: 'us-east-1',
        signingServiceName: 'states',
      },
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'HTTP',
      Name: 'custom',
      Description: 'custom description',
      HttpConfig: {
        Endpoint: endpoint,
        AuthorizationConfig: {
          AuthorizationType: 'AWS_IAM',
          AwsIamConfig: {
            SigningRegion: 'us-east-1',
            SigningServiceName: 'states',
          },
        },
      },
    });
  });

  test('other aws resources can grant http data source', () => {
    // WHEN
    const machineArn = 'arn:aws:states:us-east-1::stateMachine:hello';
    const machine = sfn.StateMachine.fromStateMachineArn(stack, 'importedMachine', machineArn);
    const ds = api.addHttpDataSource('ds', endpoint, {
      name: 'custom',
      description: 'custom description',
      authorizationConfig: {
        signingRegion: 'us-east-1',
        signingServiceName: 'states',
      },
    });
    machine.grantRead(ds);

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'states:ListExecutions',
              'states:ListStateMachines',
            ],
            Effect: 'Allow',
            Resource: machineArn,
          },
          {
            Action: [
              'states:DescribeExecution',
              'states:DescribeStateMachineForExecution',
              'states:GetExecutionHistory',
            ],
            Effect: 'Allow',
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':states:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':execution:hello:*',
                ],
              ],
            },
          },
          {
            Action: [
              'states:ListActivities',
              'states:DescribeStateMachine',
              'states:DescribeActivity',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
    });
  });

  test('appsync errors when creating multiple http data sources with no configuration', () => {
    // THEN
    expect(() => {
      api.addHttpDataSource('ds', endpoint);
      api.addHttpDataSource('ds', endpoint);
    }).toThrow("There is already a Construct with name 'ds' in GraphqlApi [baseApi]");
  });
});

describe('adding http data source from imported api', () => {
  test('imported api can add HttpDataSource from id', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
    });
    importedApi.addHttpDataSource('ds', endpoint);

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'HTTP',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });

  test('imported api can add HttpDataSource from attributes', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
      graphqlApiArn: api.arn,
    });
    importedApi.addHttpDataSource('ds', endpoint);

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'HTTP',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });
});
