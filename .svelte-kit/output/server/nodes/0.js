

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.Mzc-ygzW.js","_app/immutable/chunks/DYjCt7Qj.js","_app/immutable/chunks/B-OeOXVU.js"];
export const stylesheets = ["_app/immutable/assets/0.RS1TraUr.css"];
export const fonts = [];
