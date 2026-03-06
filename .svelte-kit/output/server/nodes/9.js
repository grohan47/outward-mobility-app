

export const index = 9;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/oge/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/9.BUEPayOT.js","_app/immutable/chunks/DYjCt7Qj.js","_app/immutable/chunks/B-OeOXVU.js"];
export const stylesheets = [];
export const fonts = [];
