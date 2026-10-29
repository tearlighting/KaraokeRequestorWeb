export type DanmakuFrameItem = { text: string; x: number; y: number };

export const DANMAKU_CANVAS_WIDTH = 1280;
export const DANMAKU_CANVAS_HEIGHT = 720;
export const DANMAKU_LANE_COUNT = 7;

/** Converts a controller frame to ASS overlay events. User text is never
 * interpreted as ASS; positions and style are supplied only by this renderer. */
export function renderDanmakuOverlay(items: DanmakuFrameItem[]) {
  return items.slice(0, DANMAKU_LANE_COUNT).map(({ text, x, y }) => {
    const safeX = Math.max(-5000, Math.min(DANMAKU_CANVAS_WIDTH, Math.round(x)));
    const safeY = Math.max(0, Math.min(DANMAKU_CANVAS_HEIGHT - 1, Math.round(y)));
    const plain = text.replace(/[\\{}\r\n]/g, ch => ch === '{' ? '(' : ch === '}' ? ')' : ch === '\\' ? '/' : ' ');
    return '{\\an7\\pos(' + safeX + ',' + safeY + ')\\fs32\\bord3\\shad1\\1c&HFFFFFF&\\3c&H202020&}' + plain;
  }).join('\n');
}

export function estimateDanmakuWidth(text: string) {
  // Conservative virtual-pixel estimate for mixed Japanese/Latin text.
  return Math.min(5000, [...text].reduce((width, char) => width + (/[^\u0000-\u00ff]/.test(char) ? 20 : 40), 0) + 40);
}
