package seed

var campusCollection = CollectionDef{
	Name: "Campus Network",
	Templates: []Template{
		{
			Name: "Campus Core - OSPF + Hosts",
			Definition: `# Two-tier campus: CHR core + distribution routers with host endpoints
name: campus-core
topology:
  nodes:
    core:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: core.rsc
    dist1:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: dist1.rsc
    dist2:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: dist2.rsc
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

  links:
    - endpoints: ["core:eth1", "dist1:eth1"]
    - endpoints: ["core:eth2", "dist2:eth1"]
    - endpoints: ["dist1:eth2", "pc1:eth1"]
    - endpoints: ["dist2:eth2", "pc2:eth1"]
`,
			BindFiles: []BindFile{
				// RouterOS configs
				{FilePath: "core.rsc", NosKind: "mikrotik_ros", Content: `# core — OSPF backbone, uplinks to dist1 and dist2
/ip/address/add address=172.16.1.1/30 interface=ether2
/ip/address/add address=172.16.2.1/30 interface=ether3
/routing/ospf/instance/add name=default router-id=10.255.0.1
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2,ether3 type=ptp
`},
				{FilePath: "dist1.rsc", NosKind: "mikrotik_ros", Content: `# dist1 — distribution router, OSPF uplink + access
/ip/address/add address=172.16.1.2/30 interface=ether2
/ip/address/add address=10.10.1.1/24 interface=ether3
/routing/ospf/instance/add name=default router-id=10.255.0.2
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2 type=ptp
/routing/ospf/interface-template/add area=backbone interfaces=ether3
`},
				{FilePath: "dist2.rsc", NosKind: "mikrotik_ros", Content: `# dist2 — distribution router, OSPF uplink + access
/ip/address/add address=172.16.2.2/30 interface=ether2
/ip/address/add address=10.10.2.1/24 interface=ether3
/routing/ospf/instance/add name=default router-id=10.255.0.3
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2 type=ptp
/routing/ospf/interface-template/add area=backbone interfaces=ether3
`},
				// FRR configs
				{FilePath: "core-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "core.conf", NosKind: "frr", Content: `hostname core
!
interface eth1
 ip address 172.16.1.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth2
 ip address 172.16.2.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
`},
				{FilePath: "dist1-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "dist1.conf", NosKind: "frr", Content: `hostname dist1
!
interface eth1
 ip address 172.16.1.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.10.1.1/24
 ip ospf area 0.0.0.0
!
router ospf
 ospf router-id 10.255.0.2
!
`},
				{FilePath: "dist2-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "dist2.conf", NosKind: "frr", Content: `hostname dist2
!
interface eth1
 ip address 172.16.2.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.10.2.1/24
 ip ospf area 0.0.0.0
!
router ospf
 ospf router-id 10.255.0.3
!
`},
			},
		},
		{
			Name: "Campus with DHCP + DNS",
			Definition: `# Campus network with CHR routing, Kea DHCP, CoreDNS, and clients
name: campus-dhcp-dns
topology:
  nodes:
    core:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: core.rsc
    dist:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: dist.rsc
    dhcp:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      binds:
        - dhcp-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    dns:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      binds:
        - dns-start.sh:/tmp/start.sh
        - hosts.db:/tmp/hosts.db
      exec:
        - ash /tmp/start.sh
    pc1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.10.3.10/24 dev eth1
        - ip route add default via 10.10.3.1
    pc2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.10.4.10/24 dev eth1
        - ip route add default via 10.10.4.1

  links:
    - endpoints: ["core:eth1", "dist:eth1"]
    - endpoints: ["dist:eth2", "dhcp:eth1"]
    - endpoints: ["dist:eth3", "dns:eth1"]
    - endpoints: ["dist:eth4", "pc1:eth1"]
    - endpoints: ["dist:eth5", "pc2:eth1"]
`,
			BindFiles: []BindFile{
				// RouterOS configs
				{FilePath: "core.rsc", NosKind: "mikrotik_ros", Content: `# core — OSPF backbone uplink
/ip/address/add address=172.16.0.1/30 interface=ether2
/routing/ospf/instance/add name=default router-id=10.255.0.1
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2 type=ptp
`},
				{FilePath: "dist.rsc", NosKind: "mikrotik_ros", Content: `# dist — distribution router, OSPF uplink + service/access subnets
/ip/address/add address=172.16.0.2/30 interface=ether2
/ip/address/add address=10.10.1.1/24 interface=ether3
/ip/address/add address=10.10.2.1/24 interface=ether4
/ip/address/add address=10.10.3.1/24 interface=ether5
/ip/address/add address=10.10.4.1/24 interface=ether6
/routing/ospf/instance/add name=default router-id=10.255.0.2
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2 type=ptp
/routing/ospf/interface-template/add area=backbone interfaces=ether3,ether4,ether5,ether6
`},
				// Universal configs
				{FilePath: "dhcp-start.sh", Content: `#!/bin/ash
ip addr add 10.10.1.2/24 dev eth1
ip route add default via 10.10.1.1
dnsmasq --no-daemon --interface=eth1 --dhcp-range=10.10.1.100,10.10.1.200,255.255.255.0,12h --dhcp-option=3,10.10.1.1 --dhcp-option=6,10.10.2.2 --log-dhcp &
echo "DHCP server ready on 10.10.1.2"
`},
				{FilePath: "dns-start.sh", Content: `#!/bin/ash
ip addr add 10.10.2.2/24 dev eth1
ip route add default via 10.10.2.1
dnsmasq --no-daemon --interface=eth1 --no-dhcp-interface=eth1 --addn-hosts=/tmp/hosts.db --log-queries &
echo "DNS server ready on 10.10.2.2"
`},
				{FilePath: "hosts.db", Content: `10.10.1.2  dhcp.campus.lab
10.10.2.2  dns.campus.lab
10.10.3.10 pc1.campus.lab
10.10.4.10 pc2.campus.lab
`},
				// FRR configs
				{FilePath: "core-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "core.conf", NosKind: "frr", Content: `hostname core
!
interface eth1
 ip address 172.16.0.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
`},
				{FilePath: "dist-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "dist.conf", NosKind: "frr", Content: `hostname dist
!
interface eth1
 ip address 172.16.0.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.10.1.1/24
 ip ospf area 0.0.0.0
!
interface eth3
 ip address 10.10.2.1/24
 ip ospf area 0.0.0.0
!
interface eth4
 ip address 10.10.3.1/24
 ip ospf area 0.0.0.0
!
interface eth5
 ip address 10.10.4.1/24
 ip ospf area 0.0.0.0
!
router ospf
 ospf router-id 10.255.0.2
!
`},
			},
		},
		{
			Name: "Full Campus",
			Definition: `# Full campus: dual CHR distribution, Kea DHCP, CoreDNS, multiple hosts
name: full-campus
topology:
  nodes:
    core:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: core.rsc
    dist1:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: dist1.rsc
    dist2:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: dist2.rsc
    dhcp:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      binds:
        - dhcp-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    dns:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      binds:
        - dns-start.sh:/tmp/start.sh
        - hosts.db:/tmp/hosts.db
      exec:
        - ash /tmp/start.sh
    pc1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.10.3.10/24 dev eth1
        - ip route add default via 10.10.3.1
    pc2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.20.1.10/24 dev eth1
        - ip route add default via 10.20.1.1
    pc3:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.20.2.10/24 dev eth1
        - ip route add default via 10.20.2.1

  links:
    # Core to distribution
    - endpoints: ["core:eth1", "dist1:eth1"]
    - endpoints: ["core:eth2", "dist2:eth1"]
    # dist1: services + one client
    - endpoints: ["dist1:eth2", "dhcp:eth1"]
    - endpoints: ["dist1:eth3", "dns:eth1"]
    - endpoints: ["dist1:eth4", "pc1:eth1"]
    # dist2: client endpoints
    - endpoints: ["dist2:eth2", "pc2:eth1"]
    - endpoints: ["dist2:eth3", "pc3:eth1"]
`,
			BindFiles: []BindFile{
				// RouterOS configs
				{FilePath: "core.rsc", NosKind: "mikrotik_ros", Content: `# core — OSPF backbone, uplinks to dist1 and dist2
/ip/address/add address=172.16.1.1/30 interface=ether2
/ip/address/add address=172.16.2.1/30 interface=ether3
/routing/ospf/instance/add name=default router-id=10.255.0.1
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2,ether3 type=ptp
`},
				{FilePath: "dist1.rsc", NosKind: "mikrotik_ros", Content: `# dist1 — services distribution, OSPF uplink + service/access subnets
/ip/address/add address=172.16.1.2/30 interface=ether2
/ip/address/add address=10.10.1.1/24 interface=ether3
/ip/address/add address=10.10.2.1/24 interface=ether4
/ip/address/add address=10.10.3.1/24 interface=ether5
/routing/ospf/instance/add name=default router-id=10.255.0.2
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2 type=ptp
/routing/ospf/interface-template/add area=backbone interfaces=ether3,ether4,ether5
`},
				{FilePath: "dist2.rsc", NosKind: "mikrotik_ros", Content: `# dist2 — client distribution, OSPF uplink + access subnets
/ip/address/add address=172.16.2.2/30 interface=ether2
/ip/address/add address=10.20.1.1/24 interface=ether3
/ip/address/add address=10.20.2.1/24 interface=ether4
/routing/ospf/instance/add name=default router-id=10.255.0.3
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=ether2 type=ptp
/routing/ospf/interface-template/add area=backbone interfaces=ether3,ether4
`},
				// Universal configs
				{FilePath: "dhcp-start.sh", Content: `#!/bin/ash
ip addr add 10.10.1.2/24 dev eth1
ip route add default via 10.10.1.1
dnsmasq --no-daemon --interface=eth1 --dhcp-range=10.10.1.100,10.10.1.200,255.255.255.0,12h --dhcp-option=3,10.10.1.1 --dhcp-option=6,10.10.2.2 --log-dhcp &
echo "DHCP server ready on 10.10.1.2"
`},
				{FilePath: "dns-start.sh", Content: `#!/bin/ash
ip addr add 10.10.2.2/24 dev eth1
ip route add default via 10.10.2.1
dnsmasq --no-daemon --interface=eth1 --no-dhcp-interface=eth1 --addn-hosts=/tmp/hosts.db --log-queries &
echo "DNS server ready on 10.10.2.2"
`},
				{FilePath: "hosts.db", Content: `10.10.1.2  dhcp.campus.lab
10.10.2.2  dns.campus.lab
10.10.3.10 pc1.campus.lab
10.20.1.10 pc2.campus.lab
10.20.2.10 pc3.campus.lab
`},
				// FRR configs
				{FilePath: "core-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "core.conf", NosKind: "frr", Content: `hostname core
!
interface eth1
 ip address 172.16.1.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth2
 ip address 172.16.2.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
`},
				{FilePath: "dist1-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "dist1.conf", NosKind: "frr", Content: `hostname dist1
!
interface eth1
 ip address 172.16.1.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.10.1.1/24
 ip ospf area 0.0.0.0
!
interface eth3
 ip address 10.10.2.1/24
 ip ospf area 0.0.0.0
!
interface eth4
 ip address 10.10.3.1/24
 ip ospf area 0.0.0.0
!
router ospf
 ospf router-id 10.255.0.2
!
`},
				{FilePath: "dist2-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "dist2.conf", NosKind: "frr", Content: `hostname dist2
!
interface eth1
 ip address 172.16.2.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.20.1.1/24
 ip ospf area 0.0.0.0
!
interface eth3
 ip address 10.20.2.1/24
 ip ospf area 0.0.0.0
!
router ospf
 ospf router-id 10.255.0.3
!
`},
			},
		},
	},
}
