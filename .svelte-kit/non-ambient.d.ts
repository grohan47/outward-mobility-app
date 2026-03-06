
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/dean" | "/dean/[id]" | "/oge" | "/oge/application" | "/oge/application/[id]" | "/program-chair" | "/program-chair/[id]" | "/student-life" | "/student-life/[id]" | "/student" | "/student/applications" | "/student/application" | "/student/application/[id]" | "/student/messages";
		RouteParams(): {
			"/dean/[id]": { id: string };
			"/oge/application/[id]": { id: string };
			"/program-chair/[id]": { id: string };
			"/student-life/[id]": { id: string };
			"/student/application/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string };
			"/dean": { id?: string };
			"/dean/[id]": { id: string };
			"/oge": { id?: string };
			"/oge/application": { id?: string };
			"/oge/application/[id]": { id: string };
			"/program-chair": { id?: string };
			"/program-chair/[id]": { id: string };
			"/student-life": { id?: string };
			"/student-life/[id]": { id: string };
			"/student": { id?: string };
			"/student/applications": Record<string, never>;
			"/student/application": { id?: string };
			"/student/application/[id]": { id: string };
			"/student/messages": Record<string, never>
		};
		Pathname(): "/" | "/dean" | "/dean/" | `/dean/${string}` & {} | `/dean/${string}/` & {} | "/oge" | "/oge/" | "/oge/application" | "/oge/application/" | `/oge/application/${string}` & {} | `/oge/application/${string}/` & {} | "/program-chair" | "/program-chair/" | `/program-chair/${string}` & {} | `/program-chair/${string}/` & {} | "/student-life" | "/student-life/" | `/student-life/${string}` & {} | `/student-life/${string}/` & {} | "/student" | "/student/" | "/student/applications" | "/student/applications/" | "/student/application" | "/student/application/" | `/student/application/${string}` & {} | `/student/application/${string}/` & {} | "/student/messages" | "/student/messages/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}