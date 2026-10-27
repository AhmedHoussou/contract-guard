import pc from 'picocolors';
/**
 * Formats and prints test results to stdout with colors and summary metrics.
 */
export function printReport(results) {
    console.log('\n' + pc.bold(pc.cyan('━'.repeat(80))));
    console.log(pc.bold(pc.cyan(' 🛡️  CONTRACT-GUARD: Autonomous API Contract & Fuzzing Report')));
    console.log(pc.bold(pc.cyan('━'.repeat(80))) + '\n');
    let passedCount = 0;
    let failedCount = 0;
    let totalDuration = 0;
    for (const res of results) {
        totalDuration += res.durationMs;
        const badge = res.passed ? pc.bgGreen(pc.black(' PASS ')) : pc.bgRed(pc.white(' FAIL '));
        const statusCol = res.actualStatus >= 200 && res.actualStatus < 300
            ? pc.green(`${res.actualStatus}`)
            : res.actualStatus >= 400 && res.actualStatus < 500
                ? pc.yellow(`${res.actualStatus}`)
                : pc.red(`${res.actualStatus || 'ERR'}`);
        const durationCol = pc.dim(`${res.durationMs}ms`);
        const mutationTag = pc.magenta(`[${res.testCase.mutationType}]`);
        console.log(`${badge} ${statusCol} ${durationCol.padEnd(8)} ${mutationTag} ${pc.bold(res.testCase.testName)}`);
        if (!res.passed) {
            failedCount++;
            for (const err of res.errors) {
                console.log(`       ${pc.red('↳')} ${pc.red(err)}`);
            }
            if (res.responseBodyPreview) {
                console.log(`       ${pc.dim('Response:')} ${pc.dim(res.responseBodyPreview)}`);
            }
        }
        else {
            passedCount++;
        }
    }
    const avgLatency = Math.round(totalDuration / (results.length || 1));
    console.log('\n' + pc.bold(pc.cyan('━'.repeat(80))));
    console.log(pc.bold(' Execution Summary:'));
    console.log(` Total Tests:  ${pc.bold(String(results.length))} | ` +
        ` Passed: ${pc.green(pc.bold(String(passedCount)))} | ` +
        ` Failed: ${failedCount > 0 ? pc.red(pc.bold(String(failedCount))) : pc.green('0')} | ` +
        ` Avg Latency: ${pc.yellow(`${avgLatency}ms`)}`);
    console.log(pc.bold(pc.cyan('━'.repeat(80))) + '\n');
    return failedCount === 0;
}
