import { EndpointOperation } from './parser.js';

export type MutationType =
  | 'HAPPY_PATH'
  | 'MISSING_REQUIRED'
  | 'BOUNDARY_VIOLATION'
  | 'ENUM_VIOLATION'
  | 'TYPE_MUTATION'
  | 'NULL_INJECTION';

export interface FuzzedTestCase {
  operationPath: string;
  method: EndpointOperation['method'];
  testName: string;
  mutationType: MutationType;
  payload: any;
  expectedStatusCategory: '2XX' | '4XX';
  description: string;
}

/**
 * Generates a compliant baseline dummy value for a given property schema.
 */
function generateValidValue(propSchema: any): any {
  if (propSchema.enum && propSchema.enum.length > 0) {
    return propSchema.enum[0];
  }

  switch (propSchema.type) {
    case 'string':
      if (propSchema.format === 'email') return 'alex.doe@example.com';
      if (propSchema.format === 'date-time') return new Date().toISOString();
      if (propSchema.minLength) return 'A'.repeat(propSchema.minLength + 2);
      return 'test-string';

    case 'integer':
    case 'number':
      if (typeof propSchema.minimum === 'number') return propSchema.minimum + 1;
      return 25;

    case 'boolean':
      return true;

    case 'array':
      return [generateValidValue(propSchema.items || { type: 'string' })];

    case 'object':
      return generateValidBaseline(propSchema);

    default:
      return 'sample-data';
  }
}

/**
 * Constructs a fully schema-compliant baseline object.
 */
export function generateValidBaseline(schema?: Record<string, any>): Record<string, any> {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return {};
  }

  const baseline: Record<string, any> = {};
  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    baseline[key] = generateValidValue(prop);
  }

  return baseline;
}

/**
 * Generates a comprehensive matrix of happy-path and fuzzed boundary mutations for an endpoint.
 */
export function generateFuzzedTestCases(operation: EndpointOperation): FuzzedTestCase[] {
  const cases: FuzzedTestCase[] = [];

  // 1. GET or endpoints without request bodies
  if (!operation.requestSchema) {
    cases.push({
      operationPath: operation.path,
      method: operation.method,
      testName: `${operation.method} ${operation.path} -> Contract Baseline`,
      mutationType: 'HAPPY_PATH',
      payload: undefined,
      expectedStatusCategory: '2XX',
      description: 'Verifies response contract matches OpenAPI schema without payload.',
    });
    return cases;
  }

  const schema = operation.requestSchema;
  const baseline = generateValidBaseline(schema);

  // 2. Baseline Happy Path
  cases.push({
    operationPath: operation.path,
    method: operation.method,
    testName: `${operation.method} ${operation.path} -> Happy Path Contract`,
    mutationType: 'HAPPY_PATH',
    payload: baseline,
    expectedStatusCategory: '2XX',
    description: 'Submits schema-compliant payload to verify successful creation/update.',
  });

  const properties = schema.properties || {};
  const requiredFields: string[] = schema.required || [];

  // 3. Negative: Missing Required Fields
  for (const requiredKey of requiredFields) {
    const mutated = { ...baseline };
    delete mutated[requiredKey];

    cases.push({
      operationPath: operation.path,
      method: operation.method,
      testName: `Omit required field: "${requiredKey}"`,
      mutationType: 'MISSING_REQUIRED',
      payload: mutated,
      expectedStatusCategory: '4XX',
      description: `Omits required field "${requiredKey}". Backend should reject with 4xx validation error.`,
    });
  }

  // 4. Boundary & Constraint Violations
  for (const [key, prop] of Object.entries<any>(properties)) {
    // Minimum integer/number boundary
    if (typeof prop.minimum === 'number') {
      const mutated = { ...baseline, [key]: prop.minimum - 1 };
      cases.push({
        operationPath: operation.path,
        method: operation.method,
        testName: `Violate minimum boundary: "${key}" (${prop.minimum - 1} < ${prop.minimum})`,
        mutationType: 'BOUNDARY_VIOLATION',
        payload: mutated,
        expectedStatusCategory: '4XX',
        description: `Submits value below minimum threshold for "${key}".`,
      });
    }

    // MinLength string boundary
    if (typeof prop.minLength === 'number' && prop.minLength > 0) {
      const mutated = { ...baseline, [key]: 'A'.repeat(prop.minLength - 1) };
      cases.push({
        operationPath: operation.path,
        method: operation.method,
        testName: `Violate minLength: "${key}" (len ${prop.minLength - 1} < ${prop.minLength})`,
        mutationType: 'BOUNDARY_VIOLATION',
        payload: mutated,
        expectedStatusCategory: '4XX',
        description: `Submits string shorter than required minLength for "${key}".`,
      });
    }

    // Enum violations
    if (Array.isArray(prop.enum) && prop.enum.length > 0) {
      const mutated = { ...baseline, [key]: 'INVALID_ENUM_CONSTANT_XYZ' };
      cases.push({
        operationPath: operation.path,
        method: operation.method,
        testName: `Invalid enum value for: "${key}"`,
        mutationType: 'ENUM_VIOLATION',
        payload: mutated,
        expectedStatusCategory: '4XX',
        description: `Injects non-whitelisted enum value for "${key}".`,
      });
    }

    // Type Mutation (Inject number into string, string into number)
    if (prop.type === 'string') {
      const mutated = { ...baseline, [key]: 12345 };
      cases.push({
        operationPath: operation.path,
        method: operation.method,
        testName: `Type mismatch for "${key}" (expected string, got number)`,
        mutationType: 'TYPE_MUTATION',
        payload: mutated,
        expectedStatusCategory: '4XX',
        description: `Injects integer into string field "${key}".`,
      });
    } else if (prop.type === 'integer' || prop.type === 'number') {
      const mutated = { ...baseline, [key]: 'not-a-number' };
      cases.push({
        operationPath: operation.path,
        method: operation.method,
        testName: `Type mismatch for "${key}" (expected number, got string)`,
        mutationType: 'TYPE_MUTATION',
        payload: mutated,
        expectedStatusCategory: '4XX',
        description: `Injects string into numeric field "${key}".`,
      });
    }

    // Null injection on required fields
    if (requiredFields.includes(key)) {
      const mutated = { ...baseline, [key]: null };
      cases.push({
        operationPath: operation.path,
        method: operation.method,
        testName: `Null injection on required field: "${key}"`,
        mutationType: 'NULL_INJECTION',
        payload: mutated,
        expectedStatusCategory: '4XX',
        description: `Sends null for required field "${key}".`,
      });
    }
  }

  return cases;
}

// Local test runner execution
if (process.argv[1] && process.argv[1].endsWith('fuzzer.ts')) {
  import('./parser.js').then(({ parseOpenApiSpec }) => {
    const ops = parseOpenApiSpec('sample-spec.yaml');
    const postOp = ops.find((o) => o.method === 'POST');

    if (postOp) {
      console.log(`Generating mutations for: ${postOp.method} ${postOp.path}...\n`);
      const testCases = generateFuzzedTestCases(postOp);
      console.log(`Generated ${testCases.length} targeted test cases:\n`);
      testCases.forEach((tc, idx) => {
        console.log(`[${idx + 1}] ${tc.mutationType.padEnd(19)} | ${tc.testName}`);
        console.log(`    Payload:`, JSON.stringify(tc.payload));
      });
    }
  });
}