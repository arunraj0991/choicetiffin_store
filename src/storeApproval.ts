/** Detect if a store profile/login payload is approved for app access. */
export function isStoreApproved(store: any): boolean {
  if (!store || typeof store !== 'object') return false;

  if (store.is_approved === 1 || store.is_approved === true || store.is_approved === '1') return true;
  if (store.is_approved === 0 || store.is_approved === false || store.is_approved === '0') return false;

  if (store.approved === 1 || store.approved === true || store.approved === '1') return true;
  if (store.approved === 0 || store.approved === false || store.approved === '0') return false;

  const status = store.status ?? store.store_status;
  if (status == null) return false;

  if (typeof status === 'string') {
    const s = status.toLowerCase();
    if (s === 'approved' || s === 'active' || s === '0') return true;
    if (s === 'pending' || s === '1' || s === 'inactive' || s === 'disabled') return false;
  }

  // Match rest of app: status 0 = active/approved
  return Number(status) === 0;
}
