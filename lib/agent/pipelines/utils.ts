export function buildDbGapWarning(announced: string[], unknown: string[]): string | null {
  const parts: string[] = [];
  if (announced.length > 0)
    parts.push(`${announced.join(", ")} ${announced.length > 1 ? "have" : "has"} been announced — we're tracking ${announced.length > 1 ? "them" : "it"} but don't have full review data yet.`);
  if (unknown.length > 0)
    parts.push(`${unknown.join(", ")} ${unknown.length > 1 ? "aren't" : "isn't"} in our database yet.`);
  return parts.length > 0
    ? parts.join(" ") + " The recommendations below are the best matches from our current reviewed dataset."
    : null;
}
