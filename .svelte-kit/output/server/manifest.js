export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.RajIuj3q.js",app:"_app/immutable/entry/app.BaY-6mU7.js",imports:["_app/immutable/entry/start.RajIuj3q.js","_app/immutable/chunks/GybWwSuI.js","_app/immutable/chunks/DYjCt7Qj.js","_app/immutable/chunks/CIlayrv1.js","_app/immutable/entry/app.BaY-6mU7.js","_app/immutable/chunks/DYjCt7Qj.js","_app/immutable/chunks/B-OeOXVU.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/dean/[id]",
				pattern: /^\/dean\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/oge",
				pattern: /^\/oge\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/oge/application/[id]",
				pattern: /^\/oge\/application\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,3,], errors: [1,,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/program-chair/[id]",
				pattern: /^\/program-chair\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,4,], errors: [1,,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/student-life/[id]",
				pattern: /^\/student-life\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,6,], errors: [1,,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/student",
				pattern: /^\/student\/?$/,
				params: [],
				page: { layouts: [0,5,], errors: [1,,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/student/applications",
				pattern: /^\/student\/applications\/?$/,
				params: [],
				page: { layouts: [0,5,], errors: [1,,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/student/application/[id]",
				pattern: /^\/student\/application\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,5,], errors: [1,,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/student/messages",
				pattern: /^\/student\/messages\/?$/,
				params: [],
				page: { layouts: [0,5,], errors: [1,,], leaf: 15 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
