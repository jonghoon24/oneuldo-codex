import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

function run(command, args) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function failureDetails(result) {
  return [
    result.stdout,
    result.stderr,
    result.error?.message,
    result.signal ? `종료 신호: ${result.signal}` : '',
    `종료 코드: ${result.status ?? '없음'}`,
  ].filter(Boolean).join('\n');
}

function block(reason) {
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
}

const changes = run('git', ['status', '--porcelain=v1', '--untracked-files=all']);

if (changes.status !== 0) {
  block(`변경사항 확인에 실패했습니다. 원인을 해결하고 다시 검사하세요.\n${failureDetails(changes)}`);
} else if (!changes.stdout.trim()) {
  process.stdout.write('{}\n');
} else {
  // Stop으로 이어진 응답에서도 검사를 생략하지 않는다. 실패하면 계속 수정해야 한다.
  const failures = [];
  for (const script of ['lint', 'build']) {
    const result = run('npm', ['run', script]);
    if (result.status !== 0) {
      failures.push(`npm run ${script}\n${failureDetails(result)}`);
    }
  }

  if (failures.length > 0) {
    block([
      '응답 종료 전 필수 검사가 실패했습니다. 아래 오류를 수정하세요.',
      'npm run lint와 npm run build가 모두 통과할 때까지 작업을 계속하세요. 훅을 끄거나 검사를 생략하지 마세요.',
      ...failures,
    ].join('\n\n'));
  } else {
    process.stdout.write('{}\n');
  }
}
