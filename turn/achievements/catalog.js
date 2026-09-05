// Stable production achievement facade.
// Query-string revisions are cache keys only; they must never select a smaller
// achievement set or otherwise change progression behavior.
export * from './catalog-production.js?revision=r241-learning-achievements';
