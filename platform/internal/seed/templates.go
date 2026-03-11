// Package seed provides sample topology templates for new installations.
package seed

import (
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/labbed/platform/internal/domain/collection"
	"github.com/labbed/platform/internal/domain/organization"
	"github.com/labbed/platform/internal/domain/topology"
)

// Template holds a sample topology definition with optional bind files.
type Template struct {
	Name       string
	Definition string
	BindFiles  []BindFile
}

type BindFile struct {
	FilePath string
	Content  string
}

// SeedDefaults creates a default org, "Sample Labs" public collection, and starter
// topologies if they don't already exist. Expects the admin user's internal ID.
func SeedDefaults(db *gorm.DB, adminUserID uint) {
	// Ensure a default org exists
	defaultOrgID := ensureDefaultOrg(db, adminUserID)

	// Check if sample collection already exists
	var count int64
	db.Model(&collection.Collection{}).Where("name = ? AND org_id = ?", "Sample Labs", defaultOrgID).Count(&count)
	if count > 0 {
		return
	}

	// Create the public sample collection
	col := &collection.Collection{
		UUID:       uuid.New().String(),
		Name:       "Sample Labs",
		OrgID:      defaultOrgID,
		CreatorID:  adminUserID,
		PublicRead: true,
	}
	if err := db.Create(col).Error; err != nil {
		log.Printf("seed: failed to create sample collection: %v", err)
		return
	}

	// Make admin an owner
	member := &collection.CollectionMember{
		CollectionID: col.ID,
		UserID:       adminUserID,
		Role:         "owner",
	}
	db.Create(member)

	// Seed topologies
	for _, tmpl := range templates {
		topo := &topology.Topology{
			UUID:         uuid.New().String(),
			Name:         tmpl.Name,
			Definition:   tmpl.Definition,
			OrgID:        defaultOrgID,
			CollectionID: col.ID,
			CreatorID:    adminUserID,
		}
		if err := db.Create(topo).Error; err != nil {
			log.Printf("seed: failed to create topology %q: %v", tmpl.Name, err)
			continue
		}

		for _, bf := range tmpl.BindFiles {
			file := &topology.BindFile{
				UUID:       uuid.New().String(),
				TopologyID: topo.ID,
				FilePath:   bf.FilePath,
				Content:    []byte(bf.Content),
			}
			db.Create(file)
		}
	}

	log.Printf("seed: created 'Sample Labs' collection with %d sample topologies", len(templates))
}

// ensureDefaultOrg creates the "Default" organization if it doesn't exist and
// makes the admin user its owner. Returns the org's database ID.
func ensureDefaultOrg(db *gorm.DB, adminUserID uint) uint {
	var org organization.Organization
	if err := db.Where("slug = ?", "default").First(&org).Error; err == nil {
		return org.ID
	}

	org = organization.Organization{
		UUID:       uuid.New().String(),
		Name:       "Default",
		Slug:       "default",
		Plan:       "free",
		MaxLabs:    0, // unlimited for default org
		MaxWorkers: 0,
	}
	if err := db.Create(&org).Error; err != nil {
		log.Printf("seed: failed to create default org: %v", err)
		return 0
	}

	member := &organization.OrganizationMember{
		OrgID:  org.ID,
		UserID: adminUserID,
		Role:   organization.RoleOwner,
	}
	db.Create(member)

	log.Printf("seed: created default organization (id=%d)", org.ID)

	// Assign any existing unscoped records to the default org
	db.Model(&collection.Collection{}).Where("org_id = 0").Update("org_id", org.ID)
	db.Table("topologies").Where("org_id = 0").Update("org_id", org.ID)
	db.Table("labs").Where("org_id = 0").Update("org_id", org.ID)
	db.Table("workers").Where("org_id = 0").Update("org_id", org.ID)

	return org.ID
}

var templates = []Template{
	{
		Name: "Two Routers - BGP",
		Definition: `# Two FRR routers with eBGP peering and Alpine hosts
name: bgp-lab
topology:
  nodes:
    router1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - router1-daemons:/etc/frr/daemons
        - router1.conf:/etc/frr/frr.conf
    router2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - router2-daemons:/etc/frr/daemons
        - router2.conf:/etc/frr/frr.conf
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
			{FilePath: "router1-daemons", Content: `bgpd=yes
ospfd=no
ospf6d=no
ripd=no
ripngd=no
isisd=no
pimd=no
ldpd=no
nhrpd=no
eigrpd=no
babeld=no
sharpd=no
staticd=yes
pbrd=no
bfdd=no
fabricd=no
vrrpd=no
`},
			{FilePath: "router1.conf", Content: `frr version 10.3
frr defaults datacenter
hostname router1
!
interface eth1
 ip address 10.1.1.1/24
!
interface eth2
 ip address 172.16.0.1/30
!
router bgp 65001
 bgp router-id 1.1.1.1
 neighbor 172.16.0.2 remote-as 65002
 !
 address-family ipv4 unicast
  network 10.1.1.0/24
 exit-address-family
!
line vty
`},
			{FilePath: "router2-daemons", Content: `bgpd=yes
ospfd=no
ospf6d=no
ripd=no
ripngd=no
isisd=no
pimd=no
ldpd=no
nhrpd=no
eigrpd=no
babeld=no
sharpd=no
staticd=yes
pbrd=no
bfdd=no
fabricd=no
vrrpd=no
`},
			{FilePath: "router2.conf", Content: `frr version 10.3
frr defaults datacenter
hostname router2
!
interface eth1
 ip address 10.2.2.1/24
!
interface eth2
 ip address 172.16.0.2/30
!
router bgp 65002
 bgp router-id 2.2.2.2
 neighbor 172.16.0.1 remote-as 65001
 !
 address-family ipv4 unicast
  network 10.2.2.0/24
 exit-address-family
!
line vty
`},
		},
	},
	{
		Name: "OSPF Triangle",
		Definition: `# Three FRR routers in OSPF area 0 with Alpine hosts
name: ospf-lab
topology:
  nodes:
    r1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - r1-daemons:/etc/frr/daemons
        - r1.conf:/etc/frr/frr.conf
    r2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - r2-daemons:/etc/frr/daemons
        - r2.conf:/etc/frr/frr.conf
    r3:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - r3-daemons:/etc/frr/daemons
        - r3.conf:/etc/frr/frr.conf
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
			{FilePath: "r1-daemons", Content: ospfDaemons},
			{FilePath: "r1.conf", Content: `frr version 10.3
frr defaults datacenter
hostname r1
!
interface eth1
 ip address 10.10.1.1/24
 ip ospf area 0
!
interface eth2
 ip address 172.16.12.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth3
 ip address 172.16.13.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface lo
 ip address 1.1.1.1/32
 ip ospf area 0
!
router ospf
 ospf router-id 1.1.1.1
!
line vty
`},
			{FilePath: "r2-daemons", Content: ospfDaemons},
			{FilePath: "r2.conf", Content: `frr version 10.3
frr defaults datacenter
hostname r2
!
interface eth1
 ip address 10.10.2.1/24
 ip ospf area 0
!
interface eth2
 ip address 172.16.12.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth3
 ip address 172.16.23.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface lo
 ip address 2.2.2.2/32
 ip ospf area 0
!
router ospf
 ospf router-id 2.2.2.2
!
line vty
`},
			{FilePath: "r3-daemons", Content: ospfDaemons},
			{FilePath: "r3.conf", Content: `frr version 10.3
frr defaults datacenter
hostname r3
!
interface eth1
 ip address 10.10.3.1/24
 ip ospf area 0
!
interface eth2
 ip address 172.16.23.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth3
 ip address 172.16.13.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface lo
 ip address 3.3.3.3/32
 ip ospf area 0
!
router ospf
 ospf router-id 3.3.3.3
!
line vty
`},
		},
	},
	{
		Name: "DHCP/DNS Server",
		Definition: `# dnsmasq providing DHCP + DNS to Alpine clients
name: dhcp-dns-lab
topology:
  nodes:
    server:
      kind: linux
      image: alpine:3.20
      binds:
        - dnsmasq.conf:/etc/dnsmasq.conf
        - server-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    client1:
      kind: linux
      image: alpine:3.20
      exec:
        - udhcpc -i eth1
    client2:
      kind: linux
      image: alpine:3.20
      exec:
        - udhcpc -i eth1

  links:
    - endpoints: ["server:eth1", "client1:eth1"]
    - endpoints: ["server:eth2", "client2:eth1"]
`,
		BindFiles: []BindFile{
			{FilePath: "dnsmasq.conf", Content: `# dnsmasq config for lab
interface=eth1
interface=eth2
bind-interfaces

# DHCP range for eth1 subnet
dhcp-range=interface:eth1,10.100.1.100,10.100.1.200,255.255.255.0,12h

# DHCP range for eth2 subnet
dhcp-range=interface:eth2,10.100.2.100,10.100.2.200,255.255.255.0,12h

# DNS entries
address=/server.lab/10.100.1.1
address=/client1.lab/10.100.1.100
address=/client2.lab/10.100.2.100

# Logging
log-queries
log-dhcp
`},
			{FilePath: "server-start.sh", Content: `#!/bin/ash
# Configure server interfaces
ip addr add 10.100.1.1/24 dev eth1
ip addr add 10.100.2.1/24 dev eth2

# Enable forwarding between subnets
echo 1 > /proc/sys/net/ipv4/ip_forward
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Install and start dnsmasq
apk add --no-cache dnsmasq
dnsmasq --no-daemon &
`},
		},
	},
	{
		Name: "Network + NAT Gateway",
		Definition: `# Alpine NAT gateway with two client subnets
name: nat-gateway-lab
topology:
  nodes:
    gateway:
      kind: linux
      image: alpine:3.20
      binds:
        - gateway-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    lan1-host:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 192.168.1.10/24 dev eth1
        - ip route add default via 192.168.1.1
    lan2-host:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 192.168.2.10/24 dev eth1
        - ip route add default via 192.168.2.1

  links:
    - endpoints: ["lan1-host:eth1", "gateway:eth1"]
    - endpoints: ["lan2-host:eth1", "gateway:eth2"]
`,
		BindFiles: []BindFile{
			{FilePath: "gateway-start.sh", Content: `#!/bin/ash
# Configure gateway interfaces
ip addr add 192.168.1.1/24 dev eth1
ip addr add 192.168.2.1/24 dev eth2

# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

# NAT for outbound traffic
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Allow forwarding between LANs
iptables -A FORWARD -i eth1 -o eth2 -j ACCEPT
iptables -A FORWARD -i eth2 -o eth1 -j ACCEPT
`},
		},
	},
	{
		Name: "FRR + DHCP Full Stack",
		Definition: `# FRR router connecting two subnets, dnsmasq for DHCP, Alpine clients
name: full-stack-lab
topology:
  nodes:
    router:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - router-daemons:/etc/frr/daemons
        - router-frr.conf:/etc/frr/frr.conf
    dhcp-server:
      kind: linux
      image: alpine:3.20
      binds:
        - dhcp.conf:/etc/dnsmasq.conf
        - dhcp-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    workstation1:
      kind: linux
      image: alpine:3.20
      exec:
        - udhcpc -i eth1
    workstation2:
      kind: linux
      image: alpine:3.20
      exec:
        - udhcpc -i eth1

  links:
    # DHCP server on router's LAN side
    - endpoints: ["dhcp-server:eth1", "router:eth1"]
    # Workstations on same LAN
    - endpoints: ["workstation1:eth1", "router:eth2"]
    - endpoints: ["workstation2:eth1", "router:eth3"]
`,
		BindFiles: []BindFile{
			{FilePath: "router-daemons", Content: `bgpd=no
ospfd=yes
ospf6d=no
ripd=no
ripngd=no
isisd=no
pimd=no
ldpd=no
nhrpd=no
eigrpd=no
babeld=no
sharpd=no
staticd=yes
pbrd=no
bfdd=no
fabricd=no
vrrpd=no
`},
			{FilePath: "router-frr.conf", Content: `frr version 10.3
frr defaults datacenter
hostname router
!
interface eth1
 ip address 10.0.0.1/24
!
interface eth2
 ip address 10.0.1.1/24
!
interface eth3
 ip address 10.0.2.1/24
!
ip route 0.0.0.0/0 eth0
!
line vty
`},
			{FilePath: "dhcp.conf", Content: `interface=eth1
bind-interfaces
dhcp-range=10.0.0.100,10.0.0.200,255.255.255.0,12h
dhcp-option=option:router,10.0.0.1
dhcp-option=option:dns-server,10.0.0.2
address=/router.lab/10.0.0.1
address=/dhcp.lab/10.0.0.2
log-queries
log-dhcp
`},
			{FilePath: "dhcp-start.sh", Content: `#!/bin/ash
ip addr add 10.0.0.2/24 dev eth1
ip route add default via 10.0.0.1
apk add --no-cache dnsmasq
dnsmasq --no-daemon &
`},
		},
	},
}

const ospfDaemons = `bgpd=no
ospfd=yes
ospf6d=no
ripd=no
ripngd=no
isisd=no
pimd=no
ldpd=no
nhrpd=no
eigrpd=no
babeld=no
sharpd=no
staticd=yes
pbrd=no
bfdd=no
fabricd=no
vrrpd=no
`
