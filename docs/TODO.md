# TODO

- [ ] In line AI Topic deepening
- [ ] Go Deeper enabled all the time
- [ ] Copy File on tab menu
- [ ] GPT Time out

[1] [LOG] [RENDERER LOG] [useExternalFileWatcher] External file change detected: C:\Projects\MarkdownPlus\docs\Universe Research Overview Deepened Report V2.md
[1] [LOG] [RENDERER LOG] [useExternalFileWatcher] Silent mode - auto-reloading file: Universe Research Overview Deepened Report V2.md
[1] [LOG] IPC: file:read called {
[1]   filePath: 'C:\\Projects\\MarkdownPlus\\docs\\Universe Research Overview Deepened Report V2.md' 
[1] }
[1] [LOG] IPC: file:read success {
[1]   filePath: 'C:\\Projects\\MarkdownPlus\\docs\\Universe Research Overview Deepened Report V2.md',
[1]   contentLength: 102582,
[1]   lineEnding: 'CRLF'
[1] }
[1] [LOG] AI IPC: edit-request { provider: 'openai', model: 'gpt-5.2', messageCount: 1 }
[1] [LOG] Secure Storage: Using API key from .env (development override) { provider: 'openai' }      
[1] [LOG] OpenAI API Request (JSON mode) {
[1]   url: 'https://api.openai.com/v1/chat/completions',
[1]   model: 'gpt-5.2',
[1]   messageCount: 2
[1] }
[1] [ERROR] Error calling OpenAI API with JSON mode TypeError: fetch failed
[1]     at node:internal/deps/undici/undici:13510:13 {
[1]   [cause]: HeadersTimeoutError: Headers Timeout Error
[1]       at FastTimer.onParserTimeout [as _onTimeout] (node:internal/deps/undici/undici:6249:32)    
[1]       at Timeout.onTick [as _onTimeout] (node:internal/deps/undici/undici:2210:17)
[1]       at listOnTimeout (node:internal/timers:588:17)
[1]       at process.processTimers (node:internal/timers:523:7) {
[1]     code: 'UND_ERR_HEADERS_TIMEOUT'
[1]   }
[1] }
[1] [ERROR] AI IPC: edit-request failed Error: Failed to call OpenAI API: fetch failed
[1]     at eval (webpack://markdown-nexus/./src/main/services/openaiApi.ts?:163:19)
[1]     at Generator.throw (<anonymous>)
[1]     at rejected (webpack://markdown-nexus/./src/main/services/openaiApi.ts?:6:65)
