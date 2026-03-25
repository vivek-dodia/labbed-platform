const NOS_DISPLAY_NAMES: Record<string, string> = {
  srl: "SR Linux",
  nokia_srlinux: "SR Linux",
  "sonic-vs": "SONiC",
  "sonic-vm": "SONiC",
  linux: "Linux",
  mikrotik_ros: "RouterOS",
  openwrt: "OpenWrt",
  freebsd: "FreeBSD",
  bridge: "Bridge",
  ovs: "Open vSwitch",
  host: "Host",
};

export function nosDisplayName(kind: string): string {
  return NOS_DISPLAY_NAMES[kind] || kind.replace(/_/g, " ");
}
