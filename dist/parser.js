import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
/**
 * Resolves local OpenAPI #/components/schemas/Name references into inline JSON schemas.
 */
function resolveSchemaRef(schema, rootSpec) {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }
    if (schema.$ref && typeof schema.$ref === 'string') {
        const refPath = schema.$ref.replace(/^#\//, '').split('/');
        let target = rootSpec;
        for (const segment of refPath) {
            if (target && segment in target) {
                target = target[segment];
            }
            else {
                throw new Error(`Unresolvable $ref: ${schema.$ref}`);
            }
        }
        // Recursively resolve in case the target itself contains references
        return resolveSchemaRef(target, rootSpec);
    }
    // Handle nested objects and arrays
    if (schema.type === 'object' && schema.properties) {
        const resolvedProps = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
            resolvedProps[key] = resolveSchemaRef(prop, rootSpec);
        }
        return { ...schema, properties: resolvedProps };
    }
    if (schema.type === 'array' && schema.items) {
        return { ...schema, items: resolveSchemaRef(schema.items, rootSpec) };
    }
    return schema;
}
/**
 * Parses an OpenAPI 3.0 YAML or JSON file and returns structured endpoint definitions.
 */
export function parseOpenApiSpec(specFilePath) {
    const resolvedPath = path.resolve(process.cwd(), specFilePath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`OpenAPI spec not found at: ${resolvedPath}`);
    }
    const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
    let spec;
    try {
        spec = resolvedPath.endsWith('.json') ? JSON.parse(rawContent) : YAML.parse(rawContent);
    }
    catch (err) {
        throw new Error(`Failed to parse OpenAPI spec: ${err.message}`);
    }
    if (!spec.paths) {
        return [];
    }
    const operations = [];
    const supportedMethods = ['get', 'post', 'put', 'patch', 'delete'];
    for (const [endpointPath, pathItem] of Object.entries(spec.paths)) {
        for (const method of supportedMethods) {
            const op = pathItem[method];
            if (!op)
                continue;
            let requestSchema;
            const jsonContent = op.requestBody?.content?.['application/json'];
            if (jsonContent?.schema) {
                requestSchema = resolveSchemaRef(jsonContent.schema, spec);
            }
            const expectedResponses = {};
            if (op.responses) {
                for (const [statusCode, resObj] of Object.entries(op.responses)) {
                    const resJson = resObj?.content?.['application/json'];
                    if (resJson?.schema) {
                        expectedResponses[statusCode] = resolveSchemaRef(resJson.schema, spec);
                    }
                }
            }
            operations.push({
                path: endpointPath,
                method: method.toUpperCase(),
                summary: op.summary,
                requestSchema,
                expectedResponses,
            });
        }
    }
    return operations;
}
// Local quick verification
if (process.argv[1] && process.argv[1].endsWith('parser.ts')) {
    const ops = parseOpenApiSpec('sample-spec.yaml');
    console.log(`Parsed ${ops.length} operation(s) successfully:\n`);
    console.dir(ops, { depth: null });
}
