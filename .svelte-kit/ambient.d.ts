
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const SHELL: string;
	export const npm_command: string;
	export const SESSION_MANAGER: string;
	export const WINDOWID: string;
	export const npm_config_userconfig: string;
	export const COLORTERM: string;
	export const XDG_CONFIG_DIRS: string;
	export const OBS_VKCAPTURE: string;
	export const npm_config_cache: string;
	export const XDG_SESSION_PATH: string;
	export const HISTCONTROL: string;
	export const XDG_MENU_PREFIX: string;
	export const HOSTNAME: string;
	export const HISTSIZE: string;
	export const ICEAUTHORITY: string;
	export const LANGUAGE: string;
	export const NODE: string;
	export const LC_ADDRESS: string;
	export const JAVA_HOME: string;
	export const LC_NAME: string;
	export const SSH_AUTH_SOCK: string;
	export const SHELL_SESSION_ID: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const COLOR: string;
	export const npm_config_local_prefix: string;
	export const DESKTOP_SESSION: string;
	export const LC_MONETARY: string;
	export const GTK_RC_FILES: string;
	export const GDK_CORE_DEVICE_EVENTS: string;
	export const npm_config_globalconfig: string;
	export const GPG_TTY: string;
	export const EDITOR: string;
	export const XDG_SEAT: string;
	export const PWD: string;
	export const XDG_SESSION_DESKTOP: string;
	export const LOGNAME: string;
	export const XDG_SESSION_TYPE: string;
	export const KWIN_FORCE_ASSUME_HDR_SUPPORT: string;
	export const npm_config_init_module: string;
	export const SYSTEMD_EXEC_PID: string;
	export const PATH_TO_FX: string;
	export const XAUTHORITY: string;
	export const SDL_VIDEO_MINIMIZE_ON_FOCUS_LOSS: string;
	export const GTK2_RC_FILES: string;
	export const OBS_VKCAPTURE_QUIET: string;
	export const HOME: string;
	export const SSH_ASKPASS: string;
	export const LC_PAPER: string;
	export const LANG: string;
	export const _JAVA_AWT_WM_NONREPARENTING: string;
	export const LS_COLORS: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const KONSOLE_DBUS_SERVICE: string;
	export const npm_package_version: string;
	export const IBUS_ENABLE_SYNC_MODE: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const WAYLAND_DISPLAY: string;
	export const KONSOLE_DBUS_SESSION: string;
	export const PROFILEHOME: string;
	export const XDG_SEAT_PATH: string;
	export const INVOCATION_ID: string;
	export const _tide_location_color: string;
	export const KONSOLE_VERSION: string;
	export const MANAGERPID: string;
	export const INIT_CWD: string;
	export const STEAM_FRAME_FORCE_CLOSE: string;
	export const KDE_SESSION_UID: string;
	export const EGL_PLATFORM: string;
	export const npm_lifecycle_script: string;
	export const MOZ_GMP_PATH: string;
	export const GAMESCOPE_WSI_HIDE_PRESENT_WAIT_EXT: string;
	export const XKB_DEFAULT_LAYOUT: string;
	export const npm_config_npm_version: string;
	export const _tide_pad: string;
	export const XDG_SESSION_CLASS: string;
	export const LC_IDENTIFICATION: string;
	export const TERM: string;
	export const npm_package_name: string;
	export const KONSOLE_DBUS_ACTIVATION_COOKIE: string;
	export const npm_config_prefix: string;
	export const LESSOPEN: string;
	export const USER: string;
	export const OPENCV_LOG_LEVEL: string;
	export const COLORFGBG: string;
	export const QT_WAYLAND_RECONNECT: string;
	export const KDE_SESSION_VERSION: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const _tide_color_separator_same_color: string;
	export const LC_TELEPHONE: string;
	export const LC_MEASUREMENT: string;
	export const XDG_VTNR: string;
	export const XDG_SESSION_ID: string;
	export const MANAGERPIDFDID: string;
	export const npm_config_user_agent: string;
	export const npm_execpath: string;
	export const XDG_RUNTIME_DIR: string;
	export const DEBUGINFOD_URLS: string;
	export const npm_package_json: string;
	export const LC_TIME: string;
	export const DEBUGINFOD_IMA_CERT_PATH: string;
	export const KDEDIRS: string;
	export const JOURNAL_STREAM: string;
	export const XDG_DATA_DIRS: string;
	export const KDE_FULL_SESSION: string;
	export const npm_config_noproxy: string;
	export const PATH: string;
	export const npm_config_node_gyp: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const npm_config_python: string;
	export const npm_config_global_prefix: string;
	export const npm_config_update_notifier: string;
	export const KDE_APPLICATIONS_AS_SCOPE: string;
	export const MAIL: string;
	export const npm_node_execpath: string;
	export const LC_NUMERIC: string;
	export const _: string;
	export const NODE_ENV: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		SHELL: string;
		npm_command: string;
		SESSION_MANAGER: string;
		WINDOWID: string;
		npm_config_userconfig: string;
		COLORTERM: string;
		XDG_CONFIG_DIRS: string;
		OBS_VKCAPTURE: string;
		npm_config_cache: string;
		XDG_SESSION_PATH: string;
		HISTCONTROL: string;
		XDG_MENU_PREFIX: string;
		HOSTNAME: string;
		HISTSIZE: string;
		ICEAUTHORITY: string;
		LANGUAGE: string;
		NODE: string;
		LC_ADDRESS: string;
		JAVA_HOME: string;
		LC_NAME: string;
		SSH_AUTH_SOCK: string;
		SHELL_SESSION_ID: string;
		MEMORY_PRESSURE_WRITE: string;
		COLOR: string;
		npm_config_local_prefix: string;
		DESKTOP_SESSION: string;
		LC_MONETARY: string;
		GTK_RC_FILES: string;
		GDK_CORE_DEVICE_EVENTS: string;
		npm_config_globalconfig: string;
		GPG_TTY: string;
		EDITOR: string;
		XDG_SEAT: string;
		PWD: string;
		XDG_SESSION_DESKTOP: string;
		LOGNAME: string;
		XDG_SESSION_TYPE: string;
		KWIN_FORCE_ASSUME_HDR_SUPPORT: string;
		npm_config_init_module: string;
		SYSTEMD_EXEC_PID: string;
		PATH_TO_FX: string;
		XAUTHORITY: string;
		SDL_VIDEO_MINIMIZE_ON_FOCUS_LOSS: string;
		GTK2_RC_FILES: string;
		OBS_VKCAPTURE_QUIET: string;
		HOME: string;
		SSH_ASKPASS: string;
		LC_PAPER: string;
		LANG: string;
		_JAVA_AWT_WM_NONREPARENTING: string;
		LS_COLORS: string;
		XDG_CURRENT_DESKTOP: string;
		KONSOLE_DBUS_SERVICE: string;
		npm_package_version: string;
		IBUS_ENABLE_SYNC_MODE: string;
		MEMORY_PRESSURE_WATCH: string;
		WAYLAND_DISPLAY: string;
		KONSOLE_DBUS_SESSION: string;
		PROFILEHOME: string;
		XDG_SEAT_PATH: string;
		INVOCATION_ID: string;
		_tide_location_color: string;
		KONSOLE_VERSION: string;
		MANAGERPID: string;
		INIT_CWD: string;
		STEAM_FRAME_FORCE_CLOSE: string;
		KDE_SESSION_UID: string;
		EGL_PLATFORM: string;
		npm_lifecycle_script: string;
		MOZ_GMP_PATH: string;
		GAMESCOPE_WSI_HIDE_PRESENT_WAIT_EXT: string;
		XKB_DEFAULT_LAYOUT: string;
		npm_config_npm_version: string;
		_tide_pad: string;
		XDG_SESSION_CLASS: string;
		LC_IDENTIFICATION: string;
		TERM: string;
		npm_package_name: string;
		KONSOLE_DBUS_ACTIVATION_COOKIE: string;
		npm_config_prefix: string;
		LESSOPEN: string;
		USER: string;
		OPENCV_LOG_LEVEL: string;
		COLORFGBG: string;
		QT_WAYLAND_RECONNECT: string;
		KDE_SESSION_VERSION: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		_tide_color_separator_same_color: string;
		LC_TELEPHONE: string;
		LC_MEASUREMENT: string;
		XDG_VTNR: string;
		XDG_SESSION_ID: string;
		MANAGERPIDFDID: string;
		npm_config_user_agent: string;
		npm_execpath: string;
		XDG_RUNTIME_DIR: string;
		DEBUGINFOD_URLS: string;
		npm_package_json: string;
		LC_TIME: string;
		DEBUGINFOD_IMA_CERT_PATH: string;
		KDEDIRS: string;
		JOURNAL_STREAM: string;
		XDG_DATA_DIRS: string;
		KDE_FULL_SESSION: string;
		npm_config_noproxy: string;
		PATH: string;
		npm_config_node_gyp: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		npm_config_python: string;
		npm_config_global_prefix: string;
		npm_config_update_notifier: string;
		KDE_APPLICATIONS_AS_SCOPE: string;
		MAIL: string;
		npm_node_execpath: string;
		LC_NUMERIC: string;
		_: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
