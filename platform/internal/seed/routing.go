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
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: router1.rsc
    router2:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: router2.rsc
    host1:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.1.1.10/24 dev eth1
        - ip route add 10.2.2.0/24 via 10.1.1.1
    host2:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.2.2.10/24 dev eth1
        - ip route add 10.1.1.0/24 via 10.2.2.1

  links:
    - endpoints: ["host1:eth1", "router1:eth1"]
    - endpoints: ["router1:eth2", "router2:eth2"]
    - endpoints: ["router2:eth1", "host2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "router1.rsc", Content: `# router1 — AS 65001, eBGP peer with router2
/ip address
add address=10.1.1.1/24 interface=ether2
add address=172.16.0.1/30 interface=ether3
/routing bgp connection
add name=to-router2 remote.address=172.16.0.2 remote.as=65002 \
    as=65001 router-id=1.1.1.1 address-families=ip \
    local.role=ebgp connect=yes listen=yes \
    output.redistribute=connected
`},
				{FilePath: "router2.rsc", Content: `# router2 — AS 65002, eBGP peer with router1
/ip address
add address=10.2.2.1/24 interface=ether2
add address=172.16.0.2/30 interface=ether3
/routing bgp connection
add name=to-router1 remote.address=172.16.0.1 remote.as=65001 \
    as=65002 router-id=2.2.2.2 address-families=ip \
    local.role=ebgp connect=yes listen=yes \
    output.redistribute=connected
`},
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
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: r1.rsc
    r2:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: r2.rsc
    r3:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: r3.rsc
    pc1:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.10.1.10/24 dev eth1
        - ip route add default via 10.10.1.1
    pc2:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.10.2.10/24 dev eth1
        - ip route add default via 10.10.2.1
    pc3:
      kind: linux
      image: alpine:3.20
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
				{FilePath: "r1.rsc", Content: `# r1 — OSPF area 0
/ip address
add address=10.10.1.1/24 interface=ether2
add address=172.16.12.1/30 interface=ether3
add address=172.16.13.1/30 interface=ether4
/routing ospf instance
add name=default router-id=1.1.1.1
/routing ospf area
add name=backbone instance=default area-id=0.0.0.0
/routing ospf interface-template
add area=backbone interfaces=ether2
add area=backbone interfaces=ether3,ether4 type=ptp
`},
				{FilePath: "r2.rsc", Content: `# r2 — OSPF area 0
/ip address
add address=10.10.2.1/24 interface=ether2
add address=172.16.12.2/30 interface=ether3
add address=172.16.23.1/30 interface=ether4
/routing ospf instance
add name=default router-id=2.2.2.2
/routing ospf area
add name=backbone instance=default area-id=0.0.0.0
/routing ospf interface-template
add area=backbone interfaces=ether2
add area=backbone interfaces=ether3,ether4 type=ptp
`},
				{FilePath: "r3.rsc", Content: `# r3 — OSPF area 0
/ip address
add address=10.10.3.1/24 interface=ether2
add address=172.16.23.2/30 interface=ether3
add address=172.16.13.2/30 interface=ether4
/routing ospf instance
add name=default router-id=3.3.3.3
/routing ospf area
add name=backbone instance=default area-id=0.0.0.0
/routing ospf interface-template
add area=backbone interfaces=ether2
add area=backbone interfaces=ether3,ether4 type=ptp
`},
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
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: core.rsc
    area1:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: area1.rsc
    area2:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: area2.rsc
    host1:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.1.0.10/24 dev eth1
        - ip route add default via 10.1.0.1
    host2:
      kind: linux
      image: alpine:3.20
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
				{FilePath: "core.rsc", Content: `# core — ABR connecting area 1 and area 2 via backbone
/interface bridge
add name=loopback
/ip address
add address=10.255.0.1/32 interface=loopback
add address=172.16.1.1/30 interface=ether2
add address=172.16.2.1/30 interface=ether3
/routing ospf instance
add name=default router-id=10.255.0.1
/routing ospf area
add name=backbone instance=default area-id=0.0.0.0
add name=area1 instance=default area-id=0.0.0.1
add name=area2 instance=default area-id=0.0.0.2
/routing ospf interface-template
add area=backbone interfaces=loopback
add area=area1 interfaces=ether2 type=ptp
add area=area2 interfaces=ether3 type=ptp
`},
				{FilePath: "area1.rsc", Content: `# area1 — router in OSPF area 1
/ip address
add address=172.16.1.2/30 interface=ether2
add address=10.1.0.1/24 interface=ether3
/routing ospf instance
add name=default router-id=10.255.0.2
/routing ospf area
add name=area1 instance=default area-id=0.0.0.1
/routing ospf interface-template
add area=area1 interfaces=ether2 type=ptp
add area=area1 interfaces=ether3
`},
				{FilePath: "area2.rsc", Content: `# area2 — router in OSPF area 2
/ip address
add address=172.16.2.2/30 interface=ether2
add address=10.2.0.1/24 interface=ether3
/routing ospf instance
add name=default router-id=10.255.0.3
/routing ospf area
add name=area2 instance=default area-id=0.0.0.2
/routing ospf interface-template
add area=area2 interfaces=ether2 type=ptp
add area=area2 interfaces=ether3
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
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: pe1.rsc
    pe2:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: pe2.rsc
    ce1:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: ce1.rsc
    ce2:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: ce2.rsc

  links:
    - endpoints: ["ce1:eth1", "pe1:eth1"]
    - endpoints: ["pe1:eth2", "pe2:eth2"]
    - endpoints: ["pe2:eth1", "ce2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "pe1.rsc", Content: `# pe1 — AS 65000 PE, iBGP to pe2, eBGP to ce1, OSPF core
/interface bridge
add name=loopback
/ip address
add address=10.255.0.1/32 interface=loopback
add address=172.16.1.1/30 interface=ether2
add address=172.16.0.1/30 interface=ether3
/routing ospf instance
add name=default router-id=10.255.0.1
/routing ospf area
add name=backbone instance=default area-id=0.0.0.0
/routing ospf interface-template
add area=backbone interfaces=loopback
add area=backbone interfaces=ether3 type=ptp
/routing bgp connection
add name=ebgp-ce1 remote.address=172.16.1.2 remote.as=65001 \
    as=65000 router-id=10.255.0.1 address-families=ip \
    local.role=ebgp connect=yes listen=yes
add name=ibgp-pe2 remote.address=10.255.0.2 remote.as=65000 \
    as=65000 router-id=10.255.0.1 address-families=ip \
    local.role=ibgp update-source=loopback connect=yes listen=yes \
    nexthop-choice=force-self
`},
				{FilePath: "pe2.rsc", Content: `# pe2 — AS 65000 PE, iBGP to pe1, eBGP to ce2, OSPF core
/interface bridge
add name=loopback
/ip address
add address=10.255.0.2/32 interface=loopback
add address=172.16.2.1/30 interface=ether2
add address=172.16.0.2/30 interface=ether3
/routing ospf instance
add name=default router-id=10.255.0.2
/routing ospf area
add name=backbone instance=default area-id=0.0.0.0
/routing ospf interface-template
add area=backbone interfaces=loopback
add area=backbone interfaces=ether3 type=ptp
/routing bgp connection
add name=ebgp-ce2 remote.address=172.16.2.2 remote.as=65002 \
    as=65000 router-id=10.255.0.2 address-families=ip \
    local.role=ebgp connect=yes listen=yes
add name=ibgp-pe1 remote.address=10.255.0.1 remote.as=65000 \
    as=65000 router-id=10.255.0.2 address-families=ip \
    local.role=ibgp update-source=loopback connect=yes listen=yes \
    nexthop-choice=force-self
`},
				{FilePath: "ce1.rsc", Content: `# ce1 — AS 65001, eBGP to pe1, advertises 10.1.0.0/24
/ip address
add address=172.16.1.2/30 interface=ether2
/ip route
add dst-address=10.1.0.0/24 type=blackhole
/routing bgp connection
add name=ebgp-pe1 remote.address=172.16.1.1 remote.as=65000 \
    as=65001 router-id=10.255.1.1 address-families=ip \
    local.role=ebgp connect=yes listen=yes \
    output.redistribute=static
`},
				{FilePath: "ce2.rsc", Content: `# ce2 — AS 65002, eBGP to pe2, advertises 10.2.0.0/24
/ip address
add address=172.16.2.2/30 interface=ether2
/ip route
add dst-address=10.2.0.0/24 type=blackhole
/routing bgp connection
add name=ebgp-pe2 remote.address=172.16.2.1 remote.as=65000 \
    as=65002 router-id=10.255.2.1 address-families=ip \
    local.role=ebgp connect=yes listen=yes \
    output.redistribute=static
`},
			},
		},
	},
}
