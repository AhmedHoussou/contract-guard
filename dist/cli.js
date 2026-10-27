#!/usr/bin/env node
import { Command } from 'commander';
import { parseOpenApiSpec } from './parser.js';
import { generateFuzzedTestCases } from './fuzzer.js';
import { executeTestCase } from './validator.js';
import { printReport } from './reporter.js';
import { startMockServer } from './mock-server.js';
const program = new Command();
program
    .name('contract-guard')
    .description('Autonomous API Contract & Boundary Fuzzing Engine for OpenAPI/Swagger')
    .version('1.0.0')
    .requiredOption('-s, --spec <path>', 'Path to OpenAPI 3.0 YAML or JSON specification')
    .option('-t, --target <url>', 'Base URL of target API', 'http://localhost:4000')
    .option('--mock', 'Spins up an internal mock server on port 4000 for zero-setup testing', false)
    .action(async (options) => {
    let mockServer = null;
    try {
        if (options.mock) {
            mockServer = startMockServer(4000);
        }
        console.log(`[ContractGuard] Loading OpenAPI spec: "${options.spec}"...`);
        const operations = parseOpenApiSpec(options.spec);
        if (operations.length === 0) {
            console.warn('No operations found in spec.');
            process.exit(0);
        }
        console.log(`[ContractGuard] Discovered ${operations.length} API operation(s). Synthesizing fuzzing matrix...\n`);
        const allResults = [];
        for (const op of operations) {
            const testCases = generateFuzzedTestCases(op);
            for (const tc of testCases) {
                const result = await executeTestCase(options.target, tc, op.expectedResponses);
                allResults.push(result);
            }
        }
        const allPassed = printReport(allResults);
        if (mockServer) {
            mockServer.close();
        }
        process.exit(allPassed ? 0 : 1);
    }
    catch (err) {
        if (mockServer) {
            mockServer.close();
        }
        console.error(`[ContractGuard] Error: ${err.message}`);
        process.exit(1);
    }
});
program.parse(process.argv);
