export async function mountHeaderAuth() {}
export function signinHref(next) { return '/signin?next=' + encodeURIComponent(next); }
