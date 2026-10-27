import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';
import { FuzzedTestCase } from './fuzzer.js';

// Handle ESM/CJS interop safely
const Ajv = (AjvModule as any).default || AjvModule;
const addFormats = (addFormatsModule as any).default || addFormatsModule;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export interface TestExecutionResult {
  testCase: FuzzedTestCase;
  actualStatus: number;
  durationMs: number;
  passed: boolean;
  errors: string[];
  responseBodyPreview?: string;
}

/**
 * Validates a response body against an expected OpenAPI response schema.
 */
function validateResponseContract(schema: Record<string, any>, data: any): string[] {
  try {
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid && validate.errors) {
      return validate.errors.map(
        (err: any) => `Schema violation at "${err.instancePath || '/'}" - ${err.message}`
      );
    }
  } catch (err: any) {
    return [`Schema compilation error: ${err.message}`];
  }

  return [];
}

/**
 * Executes a single fuzzed test case against the target API and validates the contract.
 */
export async function executeTestCase(
  baseUrl: string,
  testCase: FuzzedTestCase,
  expectedResponses: Record<string, Record<string, any>>
): Promise<TestExecutionResult> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const url = `${cleanBase}${testCase.operationPath}`;

  const requestOptions: RequestInit = {
    method: testCase.method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  if (testCase.payload !== undefined) {
    requestOptions.body = JSON.stringify(testCase.payload);
  }

  const startTime = performance.now();
  let actualStatus = 0;
  let responseData: any = null;
  let responseText = '';
  const errors: string[] = [];

  try {
    const response = await fetch(url, requestOptions);
    actualStatus = response.status;
    responseText = await response.text();

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
  } catch (netErr: any) {
    const durationMs = Math.round(performance.now() - startTime);
    return {
      testCase,
      actualStatus: 0,
      durationMs,
      passed: false,
      errors: [`Network request failed: ${netErr.message}`],
    };
  }

  const durationMs = Math.round(performance.now() - startTime);

  // 1. Validate HTTP Status Family
  if (testCase.expectedStatusCategory === '2XX') {
    if (actualStatus < 200 || actualStatus >= 300) {
      errors.push(`Expected 2xx status, received ${actualStatus}`);
    }
  } else if (testCase.expectedStatusCategory === '4XX') {
    if (actualStatus < 400 || actualStatus >= 500) {
      errors.push(`Expected 4xx client validation rejection, received ${actualStatus}`);
    }
  }

  // 2. Validate Response Schema Contract if defined for this status code
  const statusSchema = expectedResponses[String(actualStatus)];
  if (statusSchema && typeof responseData === 'object' && responseData !== null) {
    const schemaErrors = validateResponseContract(statusSchema, responseData);
    errors.push(...schemaErrors);
  }

  const passed = errors.length === 0;

  return {
    testCase,
    actualStatus,
    durationMs,
    passed,
    errors,
    responseBodyPreview: responseText.slice(0, 120),
  };
}