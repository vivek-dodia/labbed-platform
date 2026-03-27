package seed

var routingCollection = CollectionDef{
	Name: "Routing",
	Templates: []Template{
		{
			Name: "eBGP Peering - Two Routers",
			Definition: `# Two RouterOS CHR routers with eBGP peering and Alpine hosts
name: ebgp-peering
topology:
  nodes:
    router1:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: router1.rsc
    router2:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: router2.rsc
    host1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.1.10/24 dev eth1
        - ip route add 10.2.2.0/24 via 10.1.1.1
    host2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.2.2.10/24 dev eth1
        - ip route add 10.1.1.0/24 via 10.2.2.1

  links:
    - endpoints: ["host1:eth1", "router1:eth1"]
    - endpoints: ["router1:eth2", "router2:eth2"]
    - endpoints: ["router2:eth1", "host2:eth1"]
`,
			BindFiles: []BindFile{
				// RouterOS configs
				{FilePath: "router1.rsc", NosKind: "mikrotik_ros", Content: `# router1 — AS 65001, eBGP peer with router2
/ip/address/add address=10.1.1.1/24 interface=ether2
/ip/address/add address=172.16.0.1/30 interface=ether3
/routing/bgp/instance/add name=default as=65001 router-id=1.1.1.1
/routing/bgp/connection/add name=to-router2 remote.address=172.16.0.2 remote.as=65002 template=default instance=default local.role=ebgp connect=yes listen=yes output.redistribute=connected
`},
				{FilePath: "router2.rsc", NosKind: "mikrotik_ros", Content: `# router2 — AS 65002, eBGP peer with router1
/ip/address/add address=10.2.2.1/24 interface=ether2
/ip/address/add address=172.16.0.2/30 interface=ether3
/routing/bgp/instance/add name=default as=65002 router-id=2.2.2.2
/routing/bgp/connection/add name=to-router1 remote.address=172.16.0.1 remote.as=65001 template=default instance=default local.role=ebgp connect=yes listen=yes output.redistribute=connected
`},
				// FRR configs
				{FilePath: "router1-daemons", NosKind: "frr", Content: `zebra=yes
bgpd=yes
staticd=yes
`},
				{FilePath: "router1.conf", NosKind: "frr", Content: `hostname router1
!
interface eth1
 ip address 10.1.1.1/24
!
interface eth2
 ip address 172.16.0.1/30
!
router bgp 65001
 bgp router-id 1.1.1.1
 no bgp ebgp-requires-policy
 neighbor 172.16.0.2 remote-as 65002
 address-family ipv4 unicast
  redistribute connected
 exit-address-family
!
`},
				{FilePath: "router2-daemons", NosKind: "frr", Content: `zebra=yes
bgpd=yes
staticd=yes
`},
				{FilePath: "router2.conf", NosKind: "frr", Content: `hostname router2
!
interface eth1
 ip address 10.2.2.1/24
!
interface eth2
 ip address 172.16.0.2/30
!
router bgp 65002
 bgp router-id 2.2.2.2
 no bgp ebgp-requires-policy
 neighbor 172.16.0.1 remote-as 65001
 address-family ipv4 unicast
  redistribute connected
 exit-address-family
!
`},
			},
			Guide: &Guide{
				Title:         "eBGP Peering Fundamentals",
				Description:   "Learn how two routers in different autonomous systems establish eBGP peering, exchange routes, and enable end-to-end connectivity between hosts.",
				Difficulty:    "beginner",
				Concepts:      []string{"BGP", "eBGP", "Autonomous Systems", "Route Advertisement", "Peering"},
				EstimatedTime: "15 min",
				TopologyNotes: `Two routers in separate autonomous systems (AS 65001 and AS 65002) are connected via a /30 transit link (172.16.0.0/30). Each router has a LAN with a host behind it.

**Router1** (AS 65001): LAN 10.1.1.0/24, transit 172.16.0.1/30
**Router2** (AS 65002): LAN 10.2.2.0/24, transit 172.16.0.2/30

The routers exchange routes via eBGP so that host1 (10.1.1.10) can reach host2 (10.2.2.10) and vice versa.`,
				Steps: []GuideStep{
					{
						Title:       "Verify interface addressing on Router1",
						Description: "Confirm that Router1 has the correct IP addresses: 10.1.1.1/24 on its LAN interface and 172.16.0.1/30 on the transit link.",
						Hint:        "Each router needs two interfaces configured: one for the local LAN segment and one for the point-to-point transit link to its BGP peer. The /30 prefix on the transit link provides exactly 2 usable host addresses — one per router.",
						Validation: &StepValidation{
							Node: "router1", Command: "/ip/address/print", Pattern: `172\.16\.0\.1`,
							NosVariants: map[string]NosVariant{
								"frr": {Command: "vtysh -c 'show ip interface brief'", Pattern: `172\.16\.0\.1`},
							},
						},
					},
					{
						Title:       "Check BGP session status",
						Description: "Verify that the eBGP session between Router1 (AS 65001) and Router2 (AS 65002) has reached the 'established' state.",
						Hint:        "BGP peers must complete a TCP handshake on port 179 before exchanging routes. The session progresses through states: Idle → Connect → OpenSent → OpenConfirm → Established. If it's stuck in 'connect' or 'active', check that the peering IPs are reachable.",
						Validation: &StepValidation{
							Node: "router1", Command: "/routing/bgp/session/print", Pattern: `(?i)established`,
							NosVariants: map[string]NosVariant{
								"frr": {Command: "vtysh -c 'show bgp summary'", Pattern: `65002`},
							},
						},
					},
					{
						Title:       "Examine received BGP routes",
						Description: "Check what routes Router1 has learned from Router2 via BGP. You should see the 10.2.2.0/24 network.",
						Hint:        "When BGP peers establish, they exchange their routing tables according to the export policies. Router2 advertises its connected networks (including 10.2.2.0/24) to Router1. These appear in Router1's routing table as BGP routes with the next-hop being 172.16.0.2.",
						Validation: &StepValidation{
							Node: "router1", Command: "/ip/route/print where bgp", Pattern: `10\.2\.2\.0`,
							NosVariants: map[string]NosVariant{
								"frr": {Command: "vtysh -c 'show ip route bgp'", Pattern: `10\.2\.2\.0`},
							},
						},
					},
					{
						Title:       "Test end-to-end connectivity",
						Description: "Ping from host1 (10.1.1.10) to host2 (10.2.2.10) to verify that BGP route exchange has enabled full connectivity across both autonomous systems.",
						Hint:        "The ping traverses: host1 → router1 (LAN) → router1 (transit) → router2 (transit) → router2 (LAN) → host2. This works because Router1 has a BGP route to 10.2.2.0/24 via 172.16.0.2, and Router2 has a BGP route to 10.1.1.0/24 via 172.16.0.1.",
						Validation: &StepValidation{
							Node: "host1", Command: "ping -c 3 -W 2 10.2.2.10", Pattern: `bytes from 10\.2\.2\.10`,
						},
					},
					{
						Title:       "Trace the path between hosts",
						Description: "Run a traceroute from host1 to host2 to see the full path: host1 → router1 → router2 → host2.",
						Hint:        "Traceroute sends packets with increasing TTL values. Each router that decrements the TTL to 0 responds with an ICMP Time Exceeded message, revealing itself as a hop in the path. You should see 2 intermediate hops (the two routers).",
						Validation: &StepValidation{
							Node: "host1", Command: "traceroute -n -w 2 10.2.2.10", Pattern: `172\.16\.0`,
						},
					},
				},
			},
		},
		{
			Name: "OSPF Triangle",
			Definition: `# Three RouterOS CHR routers in OSPF area 0 with Alpine hosts
name: ospf-triangle
topology:
  nodes:
    r1:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: r1.rsc
    r2:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: r2.rsc
    r3:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: r3.rsc
    pc1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.10.1.10/24 dev eth1
        - ip route add default via 10.10.1.1
    pc2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.10.2.10/24 dev eth1
        - ip route add default via 10.10.2.1
    pc3:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.10.3.10/24 dev eth1
        - ip route add default via 10.10.3.1

  links:
    # Host links
    - endpoints: ["pc1:eth1", "r1:eth1"]
    - endpoints: ["pc2:eth1", "r2:eth1"]
    - endpoints: ["pc3:eth1", "r3:eth1"]
    # Router triangle
    - endpoints: ["r1:eth2", "r2:eth2"]
    - endpoints: ["r2:eth3", "r3:eth2"]
    - endpoints: ["r3:eth3", "r1:eth3"]
`,
			BindFiles: []BindFile{
				// RouterOS configs
				{FilePath: "r1.rsc", NosKind: "mikrotik_ros", Content: `# r1 — OSPF area 0
/ip/address/add address=10.10.1.1/24 interface=ether2
/ip/address/add address=172.16.12.1/30 interface=ether3
/ip/address/add address=172.16.13.1/30 interface=ether4
/routing/ospf/instance/add name=default router-id=1.1.1.1
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2
/routing/ospf/interface-template/add area=backbone interfaces=ether3,ether4 type=ptp
`},
				{FilePath: "r2.rsc", NosKind: "mikrotik_ros", Content: `# r2 — OSPF area 0
/ip/address/add address=10.10.2.1/24 interface=ether2
/ip/address/add address=172.16.12.2/30 interface=ether3
/ip/address/add address=172.16.23.1/30 interface=ether4
/routing/ospf/instance/add name=default router-id=2.2.2.2
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2
/routing/ospf/interface-template/add area=backbone interfaces=ether3,ether4 type=ptp
`},
				{FilePath: "r3.rsc", NosKind: "mikrotik_ros", Content: `# r3 — OSPF area 0
/ip/address/add address=10.10.3.1/24 interface=ether2
/ip/address/add address=172.16.23.2/30 interface=ether3
/ip/address/add address=172.16.13.2/30 interface=ether4
/routing/ospf/instance/add name=default router-id=3.3.3.3
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2
/routing/ospf/interface-template/add area=backbone interfaces=ether3,ether4 type=ptp
`},
				// FRR configs
				{FilePath: "r1-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "r1.conf", NosKind: "frr", Content: `hostname r1
!
interface eth1
 ip address 10.10.1.1/24
 ip ospf area 0.0.0.0
!
interface eth2
 ip address 172.16.12.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth3
 ip address 172.16.13.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 1.1.1.1
!
`},
				{FilePath: "r2-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "r2.conf", NosKind: "frr", Content: `hostname r2
!
interface eth1
 ip address 10.10.2.1/24
 ip ospf area 0.0.0.0
!
interface eth2
 ip address 172.16.12.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth3
 ip address 172.16.23.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 2.2.2.2
!
`},
				{FilePath: "r3-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "r3.conf", NosKind: "frr", Content: `hostname r3
!
interface eth1
 ip address 10.10.3.1/24
 ip ospf area 0.0.0.0
!
interface eth2
 ip address 172.16.23.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth3
 ip address 172.16.13.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 3.3.3.3
!
`},
			},
			Guide: &Guide{
				Title:         "OSPF Triangle — Dynamic Routing Basics",
				Description:   "Learn how three OSPF routers form adjacencies, exchange link-state advertisements, and build a shortest-path routing table.",
				Difficulty:    "beginner",
				Concepts:      []string{"OSPF", "Link-State Routing", "SPF Algorithm", "Adjacency", "Area 0"},
				EstimatedTime: "15 min",
				TopologyNotes: `Three routers (R1, R2, R3) form a triangle in OSPF area 0. Each router has a host on its LAN side. OSPF dynamically discovers neighbors, exchanges LSAs, and computes shortest paths.

**R1**: LAN 10.1.1.0/24, links to R2 (172.16.1.0/30) and R3 (172.16.3.0/30)
**R2**: LAN 10.2.2.0/24, links to R1 (172.16.1.0/30) and R3 (172.16.2.0/30)
**R3**: LAN 10.3.3.0/24, links to R2 (172.16.2.0/30) and R1 (172.16.3.0/30)`,
				Steps: []GuideStep{
					{
						Title:       "Verify OSPF neighbor adjacencies on R1",
						Description: "Check that R1 has formed Full adjacencies with both R2 and R3.",
						Hint:        "OSPF adjacencies go through states: Down → Init → 2-Way → ExStart → Exchange → Loading → Full. 'Full' means the routers have synchronized their link-state databases. On point-to-point links, adjacency forms directly without DR/BDR election.",
						Validation: &StepValidation{
							Node: "r1", Command: "/routing/ospf/neighbor/print", Pattern: `(?i)full`,
							NosVariants: map[string]NosVariant{
								"frr": {Command: "vtysh -c 'show ip ospf neighbor'", Pattern: `Full`},
							},
						},
					},
					{
						Title:       "Examine the OSPF routing table",
						Description: "Check the IP routing table on R1 to see OSPF-learned routes to the other LANs (10.2.2.0/24 and 10.3.3.0/24).",
						Hint:        "OSPF routes in the routing table show the protocol's SPF calculation result. Each route has a cost (metric) based on interface bandwidth. In a triangle topology, there are two paths to each destination — OSPF picks the lowest-cost one.",
						Validation: &StepValidation{
							Node: "r1", Command: "/ip/route/print where ospf", Pattern: `10\.(2\.2|3\.3)\.0`,
							NosVariants: map[string]NosVariant{
								"frr": {Command: "vtysh -c 'show ip route ospf'", Pattern: `10\.(2\.2|3\.3)\.0`},
							},
						},
					},
					{
						Title:       "Test connectivity across the triangle",
						Description: "Ping from PC1 (behind R1) to PC3 (behind R3) to verify OSPF routing works.",
						Hint:        "The ping goes from PC1 → R1 → R3 → PC3 (direct path) because OSPF computes R1-R3 as the shortest path. If the R1-R3 link were to fail, OSPF would reconverge and route via R2 instead.",
						Validation: &StepValidation{
							Node: "pc1", Command: "ping -c 3 -W 2 10.3.3.10", Pattern: `bytes from 10\.3\.3\.10`,
						},
					},
				},
			},
		},
		{
			Name: "OSPF Multi-Area",
			Definition: `# OSPF multi-area: core ABR bridges area 1 and area 2
name: ospf-multi-area
topology:
  nodes:
    core:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: core.rsc
    area1:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: area1.rsc
    area2:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: area2.rsc
    host1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.0.10/24 dev eth1
        - ip route add default via 10.1.0.1
    host2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.2.0.10/24 dev eth1
        - ip route add default via 10.2.0.1

  links:
    - endpoints: ["core:eth1", "area1:eth1"]
    - endpoints: ["core:eth2", "area2:eth1"]
    - endpoints: ["area1:eth2", "host1:eth1"]
    - endpoints: ["area2:eth2", "host2:eth1"]
`,
			BindFiles: []BindFile{
				// RouterOS configs
				{FilePath: "core.rsc", NosKind: "mikrotik_ros", Content: `# core — ABR connecting area 1 and area 2 via backbone
/interface/bridge/add name=loopback
/ip/address/add address=10.255.0.1/32 interface=loopback
/ip/address/add address=172.16.1.1/30 interface=ether2
/ip/address/add address=172.16.2.1/30 interface=ether3
/routing/ospf/instance/add name=default router-id=10.255.0.1
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/area/add name=area1 instance=default area-id=0.0.0.1
/routing/ospf/area/add name=area2 instance=default area-id=0.0.0.2
/routing/ospf/interface-template/add area=backbone interfaces=loopback
/routing/ospf/interface-template/add area=area1 interfaces=ether2 type=ptp
/routing/ospf/interface-template/add area=area2 interfaces=ether3 type=ptp
`},
				{FilePath: "area1.rsc", NosKind: "mikrotik_ros", Content: `# area1 — router in OSPF area 1
/ip/address/add address=172.16.1.2/30 interface=ether2
/ip/address/add address=10.1.0.1/24 interface=ether3
/routing/ospf/instance/add name=default router-id=10.255.0.2
/routing/ospf/area/add name=area1 instance=default area-id=0.0.0.1
/routing/ospf/interface-template/add area=area1 interfaces=ether2 type=ptp
/routing/ospf/interface-template/add area=area1 interfaces=ether3
`},
				{FilePath: "area2.rsc", NosKind: "mikrotik_ros", Content: `# area2 — router in OSPF area 2
/ip/address/add address=172.16.2.2/30 interface=ether2
/ip/address/add address=10.2.0.1/24 interface=ether3
/routing/ospf/instance/add name=default router-id=10.255.0.3
/routing/ospf/area/add name=area2 instance=default area-id=0.0.0.2
/routing/ospf/interface-template/add area=area2 interfaces=ether2 type=ptp
/routing/ospf/interface-template/add area=area2 interfaces=ether3
`},
				// FRR configs
				{FilePath: "core-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "core.conf", NosKind: "frr", Content: `hostname core
!
interface lo
 ip address 10.255.0.1/32
 ip ospf area 0.0.0.0
!
interface eth1
 ip address 172.16.1.1/30
 ip ospf area 0.0.0.1
 ip ospf network point-to-point
!
interface eth2
 ip address 172.16.2.1/30
 ip ospf area 0.0.0.2
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
`},
				{FilePath: "area1-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "area1.conf", NosKind: "frr", Content: `hostname area1
!
interface eth1
 ip address 172.16.1.2/30
 ip ospf area 0.0.0.1
 ip ospf network point-to-point
!
interface eth2
 ip address 10.1.0.1/24
 ip ospf area 0.0.0.1
!
router ospf
 ospf router-id 10.255.0.2
!
`},
				{FilePath: "area2-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "area2.conf", NosKind: "frr", Content: `hostname area2
!
interface eth1
 ip address 172.16.2.2/30
 ip ospf area 0.0.0.2
 ip ospf network point-to-point
!
interface eth2
 ip address 10.2.0.1/24
 ip ospf area 0.0.0.2
!
router ospf
 ospf router-id 10.255.0.3
!
`},
			},
		},
		{
			Name: "BGP + OSPF Backbone",
			Definition: `# SP backbone: iBGP between PEs (OSPF IGP), eBGP to CEs
name: bgp-ospf-backbone
topology:
  nodes:
    pe1:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: pe1.rsc
    pe2:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: pe2.rsc
    ce1:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: ce1.rsc
    ce2:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: ce2.rsc

  links:
    - endpoints: ["ce1:eth1", "pe1:eth1"]
    - endpoints: ["pe1:eth2", "pe2:eth2"]
    - endpoints: ["pe2:eth1", "ce2:eth1"]
`,
			BindFiles: []BindFile{
				// RouterOS configs
				{FilePath: "pe1.rsc", NosKind: "mikrotik_ros", Content: `# pe1 — AS 65000 PE, iBGP to pe2, eBGP to ce1, OSPF core
/interface/bridge/add name=loopback
/ip/address/add address=10.255.0.1/32 interface=loopback
/ip/address/add address=172.16.1.1/30 interface=ether2
/ip/address/add address=172.16.0.1/30 interface=ether3
/routing/ospf/instance/add name=default router-id=10.255.0.1
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=loopback
/routing/ospf/interface-template/add area=backbone interfaces=ether3 type=ptp
/routing/bgp/instance/add name=default as=65000 router-id=10.255.0.1
/routing/bgp/connection/add name=ebgp-ce1 remote.address=172.16.1.2 remote.as=65001 template=default instance=default local.role=ebgp connect=yes listen=yes
/routing/bgp/connection/add name=ibgp-pe2 remote.address=10.255.0.2 remote.as=65000 template=default instance=default local.role=ibgp connect=yes listen=yes nexthop-choice=force-self
`},
				{FilePath: "pe2.rsc", NosKind: "mikrotik_ros", Content: `# pe2 — AS 65000 PE, iBGP to pe1, eBGP to ce2, OSPF core
/interface/bridge/add name=loopback
/ip/address/add address=10.255.0.2/32 interface=loopback
/ip/address/add address=172.16.2.1/30 interface=ether2
/ip/address/add address=172.16.0.2/30 interface=ether3
/routing/ospf/instance/add name=default router-id=10.255.0.2
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=loopback
/routing/ospf/interface-template/add area=backbone interfaces=ether3 type=ptp
/routing/bgp/instance/add name=default as=65000 router-id=10.255.0.2
/routing/bgp/connection/add name=ebgp-ce2 remote.address=172.16.2.2 remote.as=65002 template=default instance=default local.role=ebgp connect=yes listen=yes
/routing/bgp/connection/add name=ibgp-pe1 remote.address=10.255.0.1 remote.as=65000 template=default instance=default local.role=ibgp connect=yes listen=yes nexthop-choice=force-self
`},
				{FilePath: "ce1.rsc", NosKind: "mikrotik_ros", Content: `# ce1 — AS 65001, eBGP to pe1, advertises 10.1.0.0/24
/ip/address/add address=172.16.1.2/30 interface=ether2
/ip/route/add dst-address=10.1.0.0/24 type=blackhole
/routing/bgp/instance/add name=default as=65001 router-id=10.255.1.1
/routing/bgp/connection/add name=ebgp-pe1 remote.address=172.16.1.1 remote.as=65000 template=default instance=default local.role=ebgp connect=yes listen=yes output.redistribute=static
`},
				{FilePath: "ce2.rsc", NosKind: "mikrotik_ros", Content: `# ce2 — AS 65002, eBGP to pe2, advertises 10.2.0.0/24
/ip/address/add address=172.16.2.2/30 interface=ether2
/ip/route/add dst-address=10.2.0.0/24 type=blackhole
/routing/bgp/instance/add name=default as=65002 router-id=10.255.2.1
/routing/bgp/connection/add name=ebgp-pe2 remote.address=172.16.2.1 remote.as=65000 template=default instance=default local.role=ebgp connect=yes listen=yes output.redistribute=static
`},
				// FRR configs
				{FilePath: "pe1-daemons", NosKind: "frr", Content: `zebra=yes
bgpd=yes
ospfd=yes
`},
				{FilePath: "pe1.conf", NosKind: "frr", Content: `hostname pe1
!
interface lo
 ip address 10.255.0.1/32
 ip ospf area 0.0.0.0
!
interface eth1
 ip address 172.16.1.1/30
!
interface eth2
 ip address 172.16.0.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
router bgp 65000
 bgp router-id 10.255.0.1
 no bgp ebgp-requires-policy
 neighbor 172.16.1.2 remote-as 65001
 neighbor 10.255.0.2 remote-as 65000
 neighbor 10.255.0.2 update-source lo
 address-family ipv4 unicast
  neighbor 10.255.0.2 next-hop-self
 exit-address-family
!
`},
				{FilePath: "pe2-daemons", NosKind: "frr", Content: `zebra=yes
bgpd=yes
ospfd=yes
`},
				{FilePath: "pe2.conf", NosKind: "frr", Content: `hostname pe2
!
interface lo
 ip address 10.255.0.2/32
 ip ospf area 0.0.0.0
!
interface eth1
 ip address 172.16.2.1/30
!
interface eth2
 ip address 172.16.0.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.2
!
router bgp 65000
 bgp router-id 10.255.0.2
 no bgp ebgp-requires-policy
 neighbor 172.16.2.2 remote-as 65002
 neighbor 10.255.0.1 remote-as 65000
 neighbor 10.255.0.1 update-source lo
 address-family ipv4 unicast
  neighbor 10.255.0.1 next-hop-self
 exit-address-family
!
`},
				{FilePath: "ce1-daemons", NosKind: "frr", Content: `zebra=yes
bgpd=yes
staticd=yes
`},
				{FilePath: "ce1.conf", NosKind: "frr", Content: `hostname ce1
!
interface eth1
 ip address 172.16.1.2/30
!
ip route 10.1.0.0/24 Null0
!
router bgp 65001
 bgp router-id 10.255.1.1
 no bgp ebgp-requires-policy
 neighbor 172.16.1.1 remote-as 65000
 address-family ipv4 unicast
  redistribute static
 exit-address-family
!
`},
				{FilePath: "ce2-daemons", NosKind: "frr", Content: `zebra=yes
bgpd=yes
staticd=yes
`},
				{FilePath: "ce2.conf", NosKind: "frr", Content: `hostname ce2
!
interface eth1
 ip address 172.16.2.2/30
!
ip route 10.2.0.0/24 Null0
!
router bgp 65002
 bgp router-id 10.255.2.1
 no bgp ebgp-requires-policy
 neighbor 172.16.2.1 remote-as 65000
 address-family ipv4 unicast
  redistribute static
 exit-address-family
!
`},
			},
		},
		{
			Name: "GoBGP Route Reflector",
			Definition: `# GoBGP route reflector with two FRR edge routers and hosts
name: gobgp-rr
topology:
  nodes:
    rr:
      kind: linux
      image: ghcr.io/vivek-dodia/mirror-gobgp:latest
      binds:
        - gobgpd.conf:/root/gobgpd.conf
      exec:
        - ip addr add 172.16.0.2/30 dev eth1
        - ip addr add 172.16.0.6/30 dev eth2
        - gobgpd -f /root/gobgpd.conf &
    edge1:
      kind: linux
      image: ghcr.io/vivek-dodia/mirror-frr:10.3.1
      binds:
        - edge1-daemons:/etc/frr/daemons
        - edge1.conf:/etc/frr/frr.conf
    edge2:
      kind: linux
      image: ghcr.io/vivek-dodia/mirror-frr:10.3.1
      binds:
        - edge2-daemons:/etc/frr/daemons
        - edge2.conf:/etc/frr/frr.conf
    host1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.1.10/24 dev eth1
        - ip route add 10.2.2.0/24 via 10.1.1.1
    host2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.2.2.10/24 dev eth1
        - ip route add 10.1.1.0/24 via 10.2.2.1

  links:
    - endpoints: ["host1:eth1", "edge1:eth2"]
    - endpoints: ["edge1:eth1", "rr:eth1"]
    - endpoints: ["rr:eth2", "edge2:eth1"]
    - endpoints: ["edge2:eth2", "host2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "gobgpd.conf", Content: `[global.config]
  as = 65000
  router-id = "10.255.0.1"

[[neighbors]]
  [neighbors.config]
    neighbor-address = "172.16.0.1"
    peer-as = 65000
  [neighbors.transport.config]
    passive-mode = true
  [neighbors.route-reflector.config]
    route-reflector-client = true
    route-reflector-cluster-id = "10.255.0.1"
  [[neighbors.afi-safis]]
    [neighbors.afi-safis.config]
      afi-safi-name = "ipv4-unicast"

[[neighbors]]
  [neighbors.config]
    neighbor-address = "172.16.0.5"
    peer-as = 65000
  [neighbors.transport.config]
    passive-mode = true
  [neighbors.route-reflector.config]
    route-reflector-client = true
    route-reflector-cluster-id = "10.255.0.1"
  [[neighbors.afi-safis]]
    [neighbors.afi-safis.config]
      afi-safi-name = "ipv4-unicast"
`},
				{FilePath: "edge1-daemons", Content: `zebra=yes
bgpd=yes
`},
				{FilePath: "edge1.conf", Content: `hostname edge1
!
interface eth1
 ip address 172.16.0.1/30
!
interface eth2
 ip address 10.1.1.1/24
!
router bgp 65000
 bgp router-id 10.255.0.11
 no bgp ebgp-requires-policy
 neighbor 172.16.0.2 remote-as 65000
 neighbor 172.16.0.2 update-source eth1
 address-family ipv4 unicast
  network 10.1.1.0/24
 exit-address-family
!
`},
				{FilePath: "edge2-daemons", Content: `zebra=yes
bgpd=yes
`},
				{FilePath: "edge2.conf", Content: `hostname edge2
!
interface eth1
 ip address 172.16.0.5/30
!
interface eth2
 ip address 10.2.2.1/24
!
router bgp 65000
 bgp router-id 10.255.0.12
 no bgp ebgp-requires-policy
 neighbor 172.16.0.6 remote-as 65000
 neighbor 172.16.0.6 update-source eth1
 address-family ipv4 unicast
  network 10.2.2.0/24
 exit-address-family
!
`},
			},
		},
	},
}
