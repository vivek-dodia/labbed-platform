package plan

import "time"

const (
	Free  = "free"
	Light = "light"
	Heavy = "heavy"
)

type Limits struct {
	MaxConcurrentLabs  int
	AllowedNosTiers    []string // "lightweight", "midweight", "heavyweight"
	MaxCloudResources  int      // 0 = unlimited
	InactivityTimeout  time.Duration
}

// NOS tier classification
const (
	TierLightweight  = "lightweight"  // FRR, Host images
	TierMidweight    = "midweight"    // MikroTik, OpenWrt, FreeBSD
	TierHeavyweight  = "heavyweight"  // Nokia SRL, Cumulus, Juniper
)

// NosImageTier maps clab kind / docker image patterns to tiers.
func NosImageTier(clabKind, dockerImage string) string {
	switch clabKind {
	case "mikrotik_ros":
		return TierMidweight
	case "openwrt":
		return TierMidweight
	case "freebsd":
		return TierMidweight
	case "srl", "sonic-vs":
		return TierHeavyweight
	case "ceos", "vr-veos", "vr-sros", "vr-xrv9k", "vr-vmx", "cvx", "vr-aoscx", "fortinet_fortigate":
		return TierHeavyweight
	case "linux":
		return TierLightweight
	}
	return TierLightweight
}

var configs = map[string]Limits{
	Free: {
		MaxConcurrentLabs: 1,
		AllowedNosTiers:   []string{TierLightweight},
		MaxCloudResources: 10,
		InactivityTimeout: 5 * time.Minute,
	},
	Light: {
		MaxConcurrentLabs: 3,
		AllowedNosTiers:   []string{TierLightweight, TierMidweight},
		MaxCloudResources: 30,
		InactivityTimeout: 15 * time.Minute,
	},
	Heavy: {
		MaxConcurrentLabs: 10,
		AllowedNosTiers:   []string{TierLightweight, TierMidweight, TierHeavyweight},
		MaxCloudResources: 0, // unlimited
		InactivityTimeout: 30 * time.Minute,
	},
}

// Get returns the limits for a plan. Defaults to Free if unknown.
func Get(planName string) Limits {
	if l, ok := configs[planName]; ok {
		return l
	}
	return configs[Free]
}

// TierAllowed checks if a NOS tier is permitted under the given plan.
func TierAllowed(planName, tier string) bool {
	limits := Get(planName)
	for _, t := range limits.AllowedNosTiers {
		if t == tier {
			return true
		}
	}
	return false
}
