/**
 * Tab-completion dictionaries for network OS shell commands.
 * Returns matching completions for a partial input string.
 */

// RouterOS CLI command tree (flat list of common paths + commands)
const ROUTEROS_COMPLETIONS = [
  // Top-level
  "/ip/address/print", "/ip/address/add", "/ip/address/remove",
  "/ip/route/print", "/ip/route/add", "/ip/route/remove",
  "/ip/firewall/filter/print", "/ip/firewall/nat/print",
  "/ip/dns/print", "/ip/dns/set",
  "/ip/dhcp-client/print", "/ip/dhcp-server/print",
  "/ip/neighbor/print",
  "/ip/arp/print",
  "/interface/print", "/interface/bridge/print", "/interface/bridge/port/print",
  "/interface/vlan/print", "/interface/ethernet/print",
  "/interface/wireless/print",
  "/routing/bgp/session/print", "/routing/bgp/connection/print", "/routing/bgp/instance/print",
  "/routing/bgp/advertisement/print",
  "/routing/ospf/instance/print", "/routing/ospf/area/print",
  "/routing/ospf/neighbor/print", "/routing/ospf/interface/print",
  "/routing/ospf/lsa/print",
  "/system/resource/print", "/system/identity/print", "/system/clock/print",
  "/system/routerboard/print", "/system/package/print",
  "/system/logging/print", "/system/ntp/client/print",
  "/log/print",
  "/ping", "/tool/traceroute",
  "export compact", "export verbose", "export",
  "/quit",
];

// FRR (vtysh) commands
const FRR_COMPLETIONS = [
  "show ip route", "show ip route summary",
  "show ip bgp", "show ip bgp summary", "show ip bgp neighbors",
  "show bgp summary", "show bgp ipv4 unicast",
  "show ip ospf", "show ip ospf neighbor", "show ip ospf route",
  "show ip ospf interface", "show ip ospf database",
  "show interface", "show interface brief",
  "show running-config",
  "show ip prefix-list", "show ip community-list",
  "show route-map",
  "show version",
  "show log",
  "ping", "traceroute",
  "configure terminal",
];

// Linux networking commands
const LINUX_COMPLETIONS = [
  "ip addr show", "ip addr add", "ip addr del",
  "ip route show", "ip route add", "ip route del",
  "ip neigh show", "ip link show",
  "ip -s link show", "ip -br addr show",
  "ping -c 4", "traceroute -n",
  "dig +short", "nslookup",
  "curl -s", "wget -q",
  "ss -tlnp", "ss -tunap", "netstat -tlnp",
  "iperf3 -s -D", "iperf3 -c",
  "tcpdump -nn -c 10 -i",
  "mtr -n -c 5",
  "ncat -zw2",
  "arp -a", "brctl show",
  "cat /etc/resolv.conf",
  "ip rule show", "ip tunnel show",
  "iptables -L -n -v", "iptables -t nat -L -n -v",
  "bridge vlan show", "bridge fdb show",
];

// OpenWrt UCI commands
const OPENWRT_COMPLETIONS = [
  "uci show network", "uci show firewall", "uci show dhcp",
  "uci show wireless", "uci show system",
  "uci get", "uci set", "uci commit",
  "/etc/init.d/network restart", "/etc/init.d/firewall restart",
  "ifconfig", "logread", "logread -f",
  "fw3 print",
  ...LINUX_COMPLETIONS,
];

/** Detect NOS type from docker image string */
function detectNos(image: string): string {
  const img = image.toLowerCase();
  if (img.includes("routeros") || img.includes("mikrotik")) return "routeros";
  if (img.includes("frr") || img.includes("frrouting")) return "frr";
  if (img.includes("openwrt")) return "openwrt";
  return "linux";
}

/** Get completions dict for a NOS type */
function getDict(nos: string): string[] {
  switch (nos) {
    case "routeros": return ROUTEROS_COMPLETIONS;
    case "frr": return FRR_COMPLETIONS;
    case "openwrt": return OPENWRT_COMPLETIONS;
    default: return LINUX_COMPLETIONS;
  }
}

export interface CompletionResult {
  /** If exactly one match, the completed text. Otherwise the common prefix. */
  completed: string;
  /** All matching candidates (shown as suggestions when >1) */
  candidates: string[];
}

/**
 * Find tab completions for a partial input.
 * Returns the longest common prefix among matches + the candidate list.
 */
export function getCompletions(input: string, image: string): CompletionResult {
  const nos = detectNos(image);
  const dict = getDict(nos);
  const trimmed = input.trimStart();

  if (!trimmed) {
    return { completed: input, candidates: [] };
  }

  const lower = trimmed.toLowerCase();
  const matches = dict.filter((c) => c.toLowerCase().startsWith(lower));

  if (matches.length === 0) {
    return { completed: input, candidates: [] };
  }

  if (matches.length === 1) {
    return { completed: matches[0] + " ", candidates: matches };
  }

  // Find longest common prefix among matches
  let prefix = matches[0];
  for (let i = 1; i < matches.length; i++) {
    while (!matches[i].toLowerCase().startsWith(prefix.toLowerCase())) {
      prefix = prefix.slice(0, -1);
    }
  }

  // Only extend input if prefix is longer than what they typed
  const completed = prefix.length > trimmed.length ? prefix : trimmed;

  return { completed, candidates: matches };
}
