/** Display-only cleanup for common release tags. Never use this value for search or reservations. */
const mediaExtension = /\.(?:mkv|mp4|m4v|avi|webm|mov|wmv|mpg|mpeg|ts|m2ts)$/i;
const technicalTag = /(?:\b(?:BDRip|BluRay|WEB[- ]?DL|WEBRip|DVDRip|DVD|HDTV|REMUX|x26[45]|h\.?26[45]|AV1|HEVC|AVC|FLAC|AAC|DTS|AC3|Opus|TrueHD|HDR|10bit|8bit)\b|\b\d{3,4}\s*[x×]\s*\d{3,4}\b|\b\d{3,4}p\b)/i;

export function formatMediaTitle(fileName: string): string {
  const basename = fileName.split(/[\\/]/).pop() || fileName;
  let title = basename.replace(mediaExtension, '');
  // Release groups commonly use a short ASCII tag at the beginning. Preserve
  // bracketed Japanese/Chinese titles and any title we cannot safely classify.
  if (technicalTag.test(title)) title = title.replace(/^\[[A-Za-z0-9_.-]{2,24}\]\s*/, '');
  title = title.replace(/\s*[([]([^\])]+)[)\]]\s*/g, (whole, content: string) => technicalTag.test(content) ? ' ' : whole);
  title = title.replace(/\s+[-_]\s*$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return title || basename;
}
