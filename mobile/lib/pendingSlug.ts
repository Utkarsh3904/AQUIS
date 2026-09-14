let _pendingSlug: string | null = null;

export function setPendingSlug(slug: string | null) {
  _pendingSlug = slug;
}

export function consumePendingSlug(): string | null {
  const slug = _pendingSlug;
  _pendingSlug = null;
  return slug;
}
