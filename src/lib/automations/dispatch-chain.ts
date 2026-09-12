// Caps how many times an outbound send can trigger another
// `keyword_match` (direction: outbound) automation whose own send step
// triggers another, and so on. Mirrors `@/lib/contacts/tag-chain`'s
// guard for `tag_added` chains — same shape, separate counter, because
// the two recursion sources are independent (an outbound chain can
// itself add a tag, and vice versa; each mechanism only needs to bound
// its own contribution).
export const MAX_OUTBOUND_CHAIN_DEPTH = 3;

export function getOutboundChainDepth(context?: {
  vars?: Record<string, unknown>;
}): number {
  const raw = context?.vars?._outbound_chain_depth;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
    ? Math.floor(raw)
    : 0;
}
