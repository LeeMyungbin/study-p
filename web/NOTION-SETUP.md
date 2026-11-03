# Study P · Notion 연결 마무리

노션에는 `Study P 연결`이 만들어져 있고, 접근 범위는 `Study P 월간 리포트 테스트` 한 페이지로 제한되어 있습니다.

## 1. 노션 토큰을 Cloudflare에 안전하게 저장

1. Notion에서 **설정 → 연결 → 연결 개발 또는 관리 → Study P 연결**을 엽니다.
2. 구성 화면의 **액세스 토큰 복사**를 누릅니다.
3. Study P 폴더에서 PowerShell을 열고 아래 명령을 실행합니다.

```powershell
pnpm.cmd exec wrangler secret put NOTION_TOKEN
```

4. `Enter a secret value:`가 나오면 복사한 토큰을 붙여넣고 Enter를 누릅니다.

토큰은 채팅이나 문서에 붙여넣지 마세요. 위 명령으로 저장하면 Cloudflare의 암호화된 비밀값으로 보관됩니다.

## 2. 업데이트 배포

```powershell
pnpm.cmd exec vite build --config vite.cloudflare.config.ts
pnpm.cmd exec wrangler deploy --config dist/server/wrangler.json
```

## 3. 테스트

1. Study P 관리자 계정으로 로그인합니다.
2. **분석 → 포트폴리오 테스트**로 이동합니다.
3. **노션 월간 리포트로 저장**을 누릅니다.
4. 노션의 `Study P 월간 리포트 테스트`에서 3개 행을 확인합니다.

같은 학생·같은 달에 버튼을 다시 눌러도 행이 중복되지 않고 최신 값으로 업데이트됩니다.
