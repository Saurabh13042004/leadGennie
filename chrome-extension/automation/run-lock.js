// Shared by Connected sync and Standalone Mode so they can never run two LinkedIn automations in the same browser at once.
let executing = false;

export const isExecuting = () => executing;
export function acquire() {
  if (executing) return false;
  executing = true;
  return true;
}
export function release() {
  executing = false;
}
