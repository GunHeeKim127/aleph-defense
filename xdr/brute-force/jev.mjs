import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

// 공식 Jev 연결 정보를 받기 전에는 네트워크 프로토콜을 추정하지 않습니다.
// 서버가 연결한 콜백에는 비식별 수치·패턴 이름만 전달하며 시간 초과/비정상 응답은 실패로 취급합니다.
export async function askJev(summary, ask, timeoutMs = 1500) {
  if (!ask && process.env.JEV_ADAPTER_MODULE) {
    try {
      const path = process.env.JEV_ADAPTER_MODULE;
      if (!isAbsolute(path)) return null;
      ask = (await import(pathToFileURL(path).href)).askJev;
    } catch { return null; }
  }
  if (typeof ask !== 'function') return null;
  const controller = new AbortController();
  let timer;
  try {
    const reply = await Promise.race([
      Promise.resolve().then(() => ask(summary, { signal: controller.signal })),
      new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs); }),
    ]);
    return typeof reply?.confidence === 'number' && Number.isFinite(reply.confidence)
      && reply.confidence >= 0 && reply.confidence <= 1 ? reply.confidence : null;
  } catch { return null; }
  finally { clearTimeout(timer); controller.abort(); }
}
