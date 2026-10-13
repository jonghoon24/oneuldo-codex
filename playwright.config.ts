import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  use: {
    baseURL,
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    // 빈 저장 데이터를 넣어 개발 예시 데이터 생성을 막는다.
    // 각 테스트의 브라우저 컨텍스트는 독립적이고, 새로고침 시에는 기록이 유지된다.
    storageState: {
      cookies: [],
      origins: [{
        origin: baseURL,
        localStorage: [{
          name: 'oneuldo.v1',
          value: JSON.stringify({ version: 1, habits: [] }),
        }],
      }],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
});
