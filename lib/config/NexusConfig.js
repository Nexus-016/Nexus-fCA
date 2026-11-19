"use strict";

/**
 * Nexus-FCA central configuration (fca-config.json).
 *
 * One file controls the whole engine: presets tune the safety/speed
 * trade-off, and every individual knob can be overridden by hand.
 *
 * Presets (config.preset):
 *   "safety"   -> slow, conservative (default)
 *   "ultra"    -> very slow, maximum account protection
 *   "nexflash" -> safe keep-alive features kept, but sends are near-instant
 *   "none"     -> no safety shaping at all (no delays, no extra requests)
 *
 * A `null` value in the template inherits the preset; any concrete value
 * overrides it. Legacy minimal configs (autoUpdate + mqtt only) keep
 * working — they simply receive the preset defaults for everything else.
 */

const fs = require("fs");
const path = require("path");

const PRESETS = {
	safety: {
		label: "Safety — conservative and slow",
		safety: {
			enabled: true,
			sendDelay: { min: 1200, max: 2500 },
			riskThrottle: true,
			humanDelays: true,
			safeHeaders: true,
			uaContinuity: true,
			loginValidation: true,
			autoRefresh: true,
			regionBypass: true,
			ultraLowBanMode: false,
			heartbeat: true,
			sessionBreath: true,
			periodicRecycle: true,
			lightPokeIntervalMs: 4 * 60 * 60 * 1000,
			adaptivePacingMs: 2 * 60 * 1000,
			minActionSpacingMs: 45 * 60 * 1000
		}
	},
	ultra: {
		label: "Ultra safety — very slow, maximum protection",
		safety: {
			enabled: true,
			sendDelay: { min: 2500, max: 5000 },
			riskThrottle: true,
			humanDelays: true,
			safeHeaders: true,
			uaContinuity: true,
			loginValidation: true,
			autoRefresh: true,
			regionBypass: true,
			ultraLowBanMode: true,
			heartbeat: true,
			sessionBreath: true,
			periodicRecycle: true,
			lightPokeIntervalMs: 3 * 60 * 60 * 1000,
			adaptivePacingMs: 5 * 60 * 1000,
			minActionSpacingMs: 45 * 60 * 1000
		}
	},
	nexflash: {
		label: "NexFlash — safe keep-alive features, near-instant sends",
		safety: {
			enabled: true,
			sendDelay: { min: 0, max: 120 },
			riskThrottle: false,
			humanDelays: false,
			safeHeaders: true,
			uaContinuity: true,
			loginValidation: true,
			autoRefresh: true,
			regionBypass: true,
			ultraLowBanMode: false,
			heartbeat: false,
			sessionBreath: false,
			periodicRecycle: false,
			lightPokeIntervalMs: 4 * 60 * 60 * 1000,
			adaptivePacingMs: 0,
			minActionSpacingMs: 0
		}
	},
	none: {
		label: "None — no safety applied",
		safety: {
			enabled: false,
			sendDelay: { min: 0, max: 0 },
			riskThrottle: false,
			humanDelays: false,
			safeHeaders: false,
			uaContinuity: false,
			loginValidation: false,
			autoRefresh: false,
			regionBypass: false,
			ultraLowBanMode: false,
			heartbeat: false,
			sessionBreath: false,
			periodicRecycle: false,
			lightPokeIntervalMs: 0,
			adaptivePacingMs: 0,
			minActionSpacingMs: 0
		}
	}
};

const DEFAULT_CONFIG = {
	_readme: "Nexus-FCA config. preset: safety | ultra | nexflash | none. null inherits the preset; any concrete value overrides it. Restart after edits.",
	preset: "safety",
	autoUpdate: false,
	autoLogin: false,
	credentials: {
		email: "",
		password: "",
		twofactor: ""
	},
	options: {
		online: true,
		selfListen: false,
		listenEvents: false,
		listenTyping: false,
		updatePresence: false,
		forceLogin: false,
		autoMarkDelivery: true,
		autoMarkRead: false,
		autoReconnect: true,
		emitReady: false,
		logLevel: "info",
		pauseLog: false,
		logRecordSize: 100
	},
	network: {
		proxy: "",
		userAgent: "",
		acceptLanguage: "en-US,en;q=0.9",
		randomUserAgent: false,
		disablePreflight: false
	},
	mqtt: {
		enabled: true,
		reconnectInterval: 3600,
		lsSendTimeoutMs: 15000
	},
	safety: {
		enabled: null,
		sendDelay: { min: null, max: null },
		riskThrottle: null,
		humanDelays: null,
		safeHeaders: null,
		uaContinuity: null,
		loginValidation: null,
		autoRefresh: null,
		regionBypass: null,
		ultraLowBanMode: null,
		heartbeat: null,
		sessionBreath: null,
		periodicRecycle: null,
		lightPokeIntervalMs: null,
		adaptivePacingMs: null,
		minActionSpacingMs: null
	},
	attachments: {
		uploadField: "farr",
		uploadRetries: 3,
		uploadRetryDelayMs: 2000
	},
	health: {
		enabled: false,
		port: 3001
	},
	sessionVault: {
		url: "",
		token: "",
		method: "",
		prefer: "vault"
	}
};

function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, override) {
	const out = Array.isArray(base) ? base.slice() : { ...base };
	if (!isPlainObject(override)) return out;
	for (const key of Object.keys(override)) {
		const value = override[key];
		if (isPlainObject(value) && isPlainObject(out[key])) {
			out[key] = deepMerge(out[key], value);
		} else if (value !== undefined && value !== null) {
			// null in the user file means "inherit the preset/default".
			out[key] = value;
		}
	}
	return out;
}

/**
 * Fill every `null` (inherit) value of the safety section from the preset
 * bundle, so a user can flip `preset` without hand-editing numbers and
 * still override any individual knob with a concrete value.
 */
function resolveSafety(userSafety, presetName) {
	const user = userSafety || {};
	// `enabled: false` means "none" semantics regardless of the preset name.
	const preset = user.enabled === false ? PRESETS.none : (PRESETS[presetName] || PRESETS.safety);
	// Collect the concrete (non-null) user values — sendDelay is merged
	// per-field so `{min: 300, max: null}` keeps the preset's max.
	const explicit = {};
	for (const key of Object.keys(user)) {
		const value = user[key];
		if (key === "sendDelay") {
			const delay = {};
			if (value && value.min !== null && value.min !== undefined) delay.min = Number(value.min);
			if (value && value.max !== null && value.max !== undefined) delay.max = Number(value.max);
			if (Object.keys(delay).length) explicit.sendDelay = delay;
			continue;
		}
		if (value !== null && value !== undefined) explicit[key] = value;
	}
	const merged = deepMerge(preset.safety, explicit);
	merged.sendDelay = {
		min: Math.max(0, Number(merged.sendDelay && merged.sendDelay.min) || 0),
		max: Math.max(0, Number(merged.sendDelay && merged.sendDelay.max) || 0)
	};
	if (merged.sendDelay.max < merged.sendDelay.min) merged.sendDelay.max = merged.sendDelay.min;
	return merged;
}

/**
 * Map the resolved safety section onto the FacebookSafety constructor
 * options (the module keeps its historical option names).
 */
function toSafetyOptions(safety) {
	const s = safety || resolveSafety(null, "safety");
	const enabled = s.enabled !== false;
	return {
		enabled: enabled,
		enableSafeHeaders: enabled && s.safeHeaders !== false,
		enableHumanBehavior: enabled && s.humanDelays !== false,
		enableAntiDetection: enabled && s.safeHeaders !== false,
		enableAutoRefresh: enabled && s.autoRefresh !== false,
		enableLoginValidation: enabled && s.loginValidation !== false,
		enableSafeDelays: enabled && s.humanDelays !== false,
		bypassRegionLock: enabled && s.regionBypass !== false,
		ultraLowBanMode: enabled && s.ultraLowBanMode === true,
		enableUAContinuity: enabled && s.uaContinuity !== false,
		sendDelayMinMs: s.sendDelay ? s.sendDelay.min : 0,
		sendDelayMaxMs: s.sendDelay ? s.sendDelay.max : 0,
		riskThrottle: enabled && s.riskThrottle !== false,
		heartbeatEnabled: enabled && s.heartbeat !== false,
		sessionBreathEnabled: enabled && s.sessionBreath !== false,
		periodicRecycleEnabled: enabled && s.periodicRecycle !== false,
		lightPokeIntervalMs: Number(s.lightPokeIntervalMs) || 0,
		adaptivePacingWindowMs: Number(s.adaptivePacingMs) || 0,
		minSpacingMs: Number(s.minActionSpacingMs) || 0
	};
}

/**
 * Global-option defaults from the config file (options + network groups).
 * Callers spread these BEFORE their explicit options so caller values win.
 */
function globalOptionDefaults(config) {
	const out = { ...config.options };
	const network = config.network || {};
	// Real environment variables always win over the checked-in file.
	if (network.userAgent && !process.env.NEXUS_UA) out.userAgent = network.userAgent;
	if (network.proxy && !process.env.NEXUS_PROXY && !process.env.HTTPS_PROXY && !process.env.HTTP_PROXY) out.proxy = network.proxy;
	if (network.acceptLanguage && !process.env.NEXUS_ACCEPT_LANGUAGE) out.acceptLanguage = network.acceptLanguage;
	if (network.randomUserAgent !== undefined) out.randomUserAgent = !!network.randomUserAgent;
	if (network.disablePreflight !== undefined && !process.env.NEXUS_DISABLE_PREFLIGHT) out.disablePreflight = !!network.disablePreflight;
	return out;
}

/**
 * Bridge the config file onto the environment-variable contract used by the
 * session vault / poke interval. Real env vars always win (deploy-time
 * control, never shadowed by a checked-in file).
 */
function bridgeEnv(config) {
	const vault = config.sessionVault || {};
	if (vault.url && !process.env.NEXUS_SESSION_VAULT_URL) process.env.NEXUS_SESSION_VAULT_URL = String(vault.url);
	if (vault.token && !process.env.NEXUS_SESSION_VAULT_TOKEN) process.env.NEXUS_SESSION_VAULT_TOKEN = String(vault.token);
	if (vault.method && !process.env.NEXUS_SESSION_VAULT_METHOD) process.env.NEXUS_SESSION_VAULT_METHOD = String(vault.method);
	if (vault.prefer && !process.env.NEXUS_SESSION_VAULT_PREFER) process.env.NEXUS_SESSION_VAULT_PREFER = String(vault.prefer);
	const envPoke = parseInt(process.env.NEXUS_LIGHT_POKE_INTERVAL, 10);
	if (Number.isFinite(envPoke) && envPoke > 0) config.safety.lightPokeIntervalMs = envPoke;
}

/**
 * Load (and on first run create) the full fca-config.json.
 * Returns { config, safety } where `config` is the merged file config and
 * `safety` is the fully resolved preset+overrides section.
 */
function loadConfig(configPath, logger) {
	const filePath = configPath || path.join(process.cwd(), "fca-config.json");
	const log = logger || console;
	let fileConfig = {};
	let created = false;
	try {
		if (!fs.existsSync(filePath)) {
			fs.writeFileSync(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2));
			created = true;
		}
		fileConfig = JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (err) {
		log.warn("NexusConfig", "Could not read " + filePath + " (" + (err && err.message ? err.message : err) + ") — using defaults");
		fileConfig = {};
	}

	const presetName = PRESETS[fileConfig.preset] ? fileConfig.preset : "safety";
	if (fileConfig.preset && !PRESETS[fileConfig.preset]) {
		log.warn("NexusConfig", "Unknown preset '" + fileConfig.preset + "' — falling back to 'safety'");
	}
	const config = deepMerge(DEFAULT_CONFIG, fileConfig);
	config.preset = presetName;
	const safety = resolveSafety(fileConfig.safety || {}, presetName);
	config.safety = safety;
	bridgeEnv(config);

	if (typeof log.info === "function") {
		log.info("NexusConfig", "preset=" + presetName + " (" + PRESETS[presetName].label + ")"
			+ " | sendDelay=" + safety.sendDelay.min + "-" + safety.sendDelay.max + "ms"
			+ " | safety=" + (safety.enabled ? "on" : "off")
			+ (created ? " | fca-config.json created with the full template" : ""));
	} else {
		log.log("[NexusConfig] preset=" + presetName);
	}

	return { config, safety, preset: presetName, path: filePath, created };
}

module.exports = {
	PRESETS,
	DEFAULT_CONFIG,
	loadConfig,
	resolveSafety,
	toSafetyOptions,
	globalOptionDefaults,
	deepMerge
};
