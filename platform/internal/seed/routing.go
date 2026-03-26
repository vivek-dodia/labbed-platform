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
	},
}
